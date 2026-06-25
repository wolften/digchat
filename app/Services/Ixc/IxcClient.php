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
