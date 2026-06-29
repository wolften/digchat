<?php

namespace App\Services\Ixc;

use App\Models\IntegrationConfig;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class IxcClient
{
    public function __construct(private IntegrationConfig $config) {}

    private function listRequest(string $resource, array $params): array
    {
        $url  = rtrim($this->config->base_url, '/') . '/webservice/v1/' . $resource;
        $auth = 'Basic ' . base64_encode($this->config->token);

        try {
            $response = Http::withHeaders([
                'Authorization' => $auth,
                'ixcsoft'       => 'listar',
            ])->post($url, $params);

            if (! $response->successful()) {
                Log::warning('IxcClient: resposta não-ok', [
                    'resource' => $resource,
                    'status'   => $response->status(),
                    'body'     => $response->body(),
                ]);
                return ['registros' => [], 'total' => '0'];
            }

            return $response->json() ?? ['registros' => [], 'total' => '0'];
        } catch (Throwable $e) {
            Log::error('IxcClient: erro na requisição', [
                'resource'  => $resource,
                'message'   => $e->getMessage(),
            ]);
            return ['registros' => [], 'total' => '0'];
        }
    }

    public function searchClientes(string $name): array
    {
        // LIKE is blocked on some IXC servers; ">=" sorted alphabetically
        // gives "starts-with" behaviour for the first page of results.
        return $this->listRequest('cliente', [
            'qtype'     => 'cliente.razao',
            'query'     => mb_strtoupper($name),
            'oper'      => '>=',
            'page'      => '1',
            'rp'        => '20',
            'sortname'  => 'cliente.razao',
            'sortorder' => 'asc',
        ]);
    }

    public function searchClienteByDocument(string $document): array
    {
        $digits = preg_replace('/\D+/', '', $document) ?: '';

        if ($digits === '') {
            return ['registros' => [], 'total' => '0'];
        }

        // IXC stores CPF/CNPJ formatted — try formatted first, fall back to raw digits, then LIKE.
        $formatted = $this->formatDocumentForQuery($digits);
        $query = $formatted !== $digits ? $formatted : $digits;

        $result = $this->listRequest('cliente', [
            'qtype'     => 'cliente.cnpj_cpf',
            'query'     => $query,
            'oper'      => '=',
            'page'      => '1',
            'rp'        => '20',
            'sortname'  => 'cliente.id',
            'sortorder' => 'asc',
        ]);

        if (! empty($result['registros'])) {
            return $result;
        }

        // Fallback: some IXC instances store digits only.
        if ($query !== $digits) {
            $result = $this->listRequest('cliente', [
                'qtype'     => 'cliente.cnpj_cpf',
                'query'     => $digits,
                'oper'      => '=',
                'page'      => '1',
                'rp'        => '20',
                'sortname'  => 'cliente.id',
                'sortorder' => 'asc',
            ]);

            if (! empty($result['registros'])) {
                return $result;
            }
        }

        return ['registros' => [], 'total' => '0'];
    }

    private function formatDocumentForQuery(string $digits): string
    {
        if (strlen($digits) === 11) {
            return preg_replace('/(\d{3})(\d{3})(\d{3})(\d{2})/', '$1.$2.$3-$4', $digits) ?: $digits;
        }

        if (strlen($digits) === 14) {
            return preg_replace('/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/', '$1.$2.$3/$4-$5', $digits) ?: $digits;
        }

        return $digits;
    }

    public function getContratos(int $clienteId): array
    {
        return $this->listRequest('cliente_contrato', [
            'qtype'     => 'cliente_contrato.id_cliente',
            'query'     => (string) $clienteId,
            'oper'      => '=',
            'page'      => '1',
            'rp'        => '50',
            'sortname'  => 'cliente_contrato.id',
            'sortorder' => 'asc',
        ]);
    }

    public function getBoletosContrato(string $idContrato): array
    {
        // Omit sortname/sortorder — some IXC servers reject certain sort columns.
        return $this->listRequest('fn_areceber', [
            'qtype' => 'fn_areceber.id_contrato',
            'query' => $idContrato,
            'oper'  => '=',
            'page'  => '1',
            'rp'    => '20',
        ]);
    }

    public function getFaturasAbertasContrato(string $idContrato): array
    {
        $result = $this->getBoletosContrato($idContrato);
        $faturas = $result['registros'] ?? [];

        if (! is_array($faturas)) {
            return [];
        }

        $open = array_filter($faturas, function (array $fatura): bool {
            $status = (string) ($fatura['status'] ?? '');
            $renegociado = (string) ($fatura['titulo_renegociado'] ?? 'N');

            return $status === 'A' && $renegociado !== 'S';
        });

        usort($open, fn (array $a, array $b): int => strcmp(
            (string) ($a['data_vencimento'] ?? ''),
            (string) ($b['data_vencimento'] ?? ''),
        ));

        return array_values($open);
    }

    public function getBoleto(string $invoiceId): ?string
    {
        $url  = rtrim($this->config->base_url, '/') . '/webservice/v1/get_boleto';
        $auth = 'Basic ' . base64_encode($this->config->token);

        try {
            $response = Http::withHeaders(['Authorization' => $auth])
                ->post($url, [
                    'boletos'         => $invoiceId,
                    'juro'            => 'S',
                    'multa'           => 'S',
                    'atualiza_boleto' => 'S',
                    'tipo_boleto'     => 'arquivo',
                    'base64'          => 'S',
                ]);

            if (! $response->successful()) {
                Log::warning('IxcClient: get_boleto não-ok', ['status' => $response->status()]);
                return null;
            }

            $body = trim($response->body());

            // Response is raw base64-encoded PDF (starts with JVBERi0x = "%PDF").
            if (str_starts_with($body, 'JVBERi0x')) {
                return $body;
            }

            // Fallback: some versions return JSON with a 'boleto' key.
            $json = $response->json();
            if (is_array($json) && ! empty($json['boleto'])) {
                return $json['boleto'];
            }

            Log::warning('IxcClient: get_boleto resposta inesperada', ['body_prefix' => substr($body, 0, 80)]);
            return null;
        } catch (Throwable $e) {
            Log::error('IxcClient: get_boleto exception', ['message' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Returns ['codigo' => '<EMV copia-e-cola>', 'qrcode_base64' => '<PNG base64>']
     * or null if PIX is not available for the invoice.
     *
     * @return array{codigo: string, qrcode_base64: string}|null
     */
    public function getPix(string $invoiceId): ?array
    {
        $url  = rtrim($this->config->base_url, '/') . '/webservice/v1/get_pix';
        $auth = 'Basic ' . base64_encode($this->config->token);

        try {
            $response = Http::withHeaders(['Authorization' => $auth])
                ->post($url, ['id_areceber' => $invoiceId]);

            if (! $response->successful()) {
                Log::warning('IxcClient: get_pix não-ok', ['status' => $response->status()]);
                return null;
            }

            $json = $response->json();

            if (! is_array($json) || ($json['type'] ?? '') === 'error') {
                Log::warning('IxcClient: get_pix erro', ['response' => $json]);
                return null;
            }

            // Response: {gateway, pix: {dadosPix, qrCode: {qrcode, imagemQrcode}}, type}
            $qrCode  = $json['pix']['qrCode'] ?? null;
            $codigo  = is_array($qrCode) ? ($qrCode['qrcode'] ?? null) : null;
            $imagem  = is_array($qrCode) ? ($qrCode['imagemQrcode'] ?? null) : null;

            // Fallback: some versions return pix as a plain EMV string.
            if ($codigo === null) {
                $pix = $json['pix'] ?? null;
                if (is_string($pix) && $pix !== '') {
                    $codigo = $pix;
                }
            }

            if (! $codigo) {
                Log::warning('IxcClient: get_pix sem código EMV', ['json' => $json]);
                return null;
            }

            return ['codigo' => $codigo, 'qrcode_base64' => (string) ($imagem ?? '')];
        } catch (Throwable $e) {
            Log::error('IxcClient: get_pix exception', ['message' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * @return array{ok: bool, message: string}
     */
    public function unlockTrust(string $contractId): array
    {
        $url  = rtrim($this->config->base_url, '/') . '/webservice/v1/desbloqueio_confianca';
        $auth = 'Basic ' . base64_encode($this->config->token);

        try {
            $response = Http::withHeaders(['Authorization' => $auth])
                ->post($url, ['id' => $contractId]);
        } catch (Throwable $e) {
            Log::error('IxcClient: desbloqueio exception', ['message' => $e->getMessage()]);

            return [
                'ok' => false,
                'message' => 'Não foi possível comunicar com o IXC para solicitar o desbloqueio.',
            ];
        }

        if (! $response->successful()) {
            Log::warning('IxcClient: desbloqueio não-ok', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return [
                'ok' => false,
                'message' => 'O IXC recusou a solicitação de desbloqueio.',
            ];
        }

        $json = $response->json();

        if (is_array($json) && ($json['type'] ?? '') === 'error') {
            return [
                'ok' => false,
                'message' => (string) ($json['message'] ?? $json['msg'] ?? 'O IXC não permitiu o desbloqueio neste momento.'),
            ];
        }

        return [
            'ok' => true,
            'message' => is_array($json)
                ? (string) ($json['message'] ?? $json['msg'] ?? 'Desbloqueio solicitado com sucesso.')
                : 'Desbloqueio solicitado com sucesso.',
        ];
    }

    public function getCliente(string $clienteId): array
    {
        return $this->listRequest('cliente', [
            'qtype'     => 'cliente.id',
            'query'     => $clienteId,
            'oper'      => '=',
            'page'      => '1',
            'rp'        => '1',
            'sortname'  => 'cliente.id',
            'sortorder' => 'asc',
        ]);
    }

    public function getServicosContrato(string $idContrato): array
    {
        return $this->listRequest('cliente_contrato_servicos', [
            'qtype'     => 'cliente_contrato_servicos.id_contrato',
            'query'     => $idContrato,
            'oper'      => '=',
            'page'      => '1',
            'rp'        => '100',
            'sortname'  => 'cliente_contrato_servicos.id',
            'sortorder' => 'asc',
        ]);
    }

    public function getComodatosContrato(string $idContrato): array
    {
        return $this->listRequest('cliente_contrato_comodato', [
            'qtype'      => 'movimento_produtos.id_contrato',
            'query'      => $idContrato,
            'oper'       => '=',
            'page'       => '1',
            'rp'         => '100',
            'sortname'   => 'movimento_produtos.id',
            'sortorder'  => 'asc',
            'grid_param' => json_encode([
                ['TB' => 'movimento_produtos.status_comodato', 'OP' => '=', 'P' => 'E'],
            ]),
        ]);
    }

    public function getTickets(string $idCliente): array
    {
        return $this->listRequest('su_ticket', [
            'qtype'     => 'su_ticket.id_cliente',
            'query'     => $idCliente,
            'oper'      => '=',
            'page'      => '1',
            'rp'        => '50',
            'sortname'  => 'su_ticket.id',
            'sortorder' => 'desc',
        ]);
    }

    public function getOrdensServico(string $idCliente): array
    {
        return $this->listRequest('su_oss_chamado', [
            'qtype'     => 'su_oss_chamado.id_cliente',
            'query'     => $idCliente,
            'oper'      => '=',
            'page'      => '1',
            'rp'        => '50',
            'sortname'  => 'su_oss_chamado.id',
            'sortorder' => 'desc',
        ]);
    }

    public function getOssAssuntos(): array
    {
        return $this->listRequest('su_oss_assunto', [
            'qtype'     => 'su_oss_assunto.id',
            'query'     => '1',
            'oper'      => '>=',
            'page'      => '1',
            'rp'        => '1000',
            'sortname'  => 'su_oss_assunto.id',
            'sortorder' => 'asc',
        ]);
    }

    public function getVoipSipeersByContrato(string $idContrato): array
    {
        return $this->listRequest('voip_sippeers', [
            'qtype'     => 'voip_sippeers.id_contrato',
            'query'     => $idContrato,
            'oper'      => '=',
            'page'      => '1',
            'rp'        => '100',
            'sortname'  => 'voip_sippeers.id',
            'sortorder' => 'asc',
        ]);
    }

    public function getLinhaMvnoByContrato(string $idContrato): array
    {
        return $this->listRequest('linha_mvno', [
            'qtype'     => 'linha_mvno.id_contrato',
            'query'     => $idContrato,
            'oper'      => '=',
            'page'      => '1',
            'rp'        => '100',
            'sortname'  => 'linha_mvno.id',
            'sortorder' => 'asc',
        ]);
    }

    public function getLoginStatusByContrato(string $idContrato): array
    {
        return $this->listRequest('radusuarios', [
            'qtype'     => 'radusuarios.id_contrato',
            'query'     => $idContrato,
            'oper'      => '=',
            'page'      => '1',
            'rp'        => '1',
            'sortname'  => 'radusuarios.id',
            'sortorder' => 'desc',
        ]);
    }

    public function getLoginStatusByLogin(string $login): array
    {
        return $this->listRequest('radusuarios', [
            'qtype'     => 'radusuarios.login',
            'query'     => $login,
            'oper'      => '=',
            'page'      => '1',
            'rp'        => '1',
            'sortname'  => 'radusuarios.id',
            'sortorder' => 'desc',
        ]);
    }

    public function testConnection(): bool
    {
        try {
            $result = $this->listRequest('cliente', [
                'qtype'     => 'cliente.id',
                'query'     => '1',
                'oper'      => '>=',
                'page'      => '1',
                'rp'        => '1',
                'sortname'  => 'cliente.id',
                'sortorder' => 'asc',
            ]);
            return array_key_exists('total', $result);
        } catch (Throwable) {
            return false;
        }
    }

}
