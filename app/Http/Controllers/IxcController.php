<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use App\Models\Conversation;
use App\Models\IntegrationConfig;
use App\Services\Ixc\IxcClient;
use App\Services\WhatsApp\MessageSender;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class IxcController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $query  = $request->string('q')->trim()->toString();
        $config = IntegrationConfig::activeIxc();

        if (! $config) {
            return response()->json(['error' => 'Nenhuma integração IXC ativa configurada.'], 422);
        }

        if (strlen($query) < 2) {
            return response()->json([]);
        }

        $client = new IxcClient($config);
        $result = $client->searchClientes($query);

        $registros = $result['registros'] ?? [];
        if (! is_array($registros)) {
            $registros = [];
        }

        // Filter client-side: keep only entries that actually start with the query
        // (the >= operator may return alphabetically later names on the same page).
        $upper = mb_strtoupper($query);
        $registros = array_filter($registros, fn ($r) => str_starts_with(
            mb_strtoupper(trim((string) ($r['razao'] ?? ''))),
            $upper
        ));

        return response()->json(array_values(array_map(fn ($r) => [
            'id'       => $r['id'] ?? '',
            'razao'    => $r['razao'] ?? '',
            'fantasia' => $r['fantasia'] ?? '',
            'cnpj_cpf' => $r['cnpj_cpf'] ?? '',
        ], $registros)));
    }

    public function link(Request $request, Contact $contact): JsonResponse
    {
        $validated = $request->validate([
            'ixc_customer_id'   => ['required', 'string'],
            'ixc_customer_name' => ['required', 'string'],
            'ixc_document'      => ['nullable', 'string', 'max:20'],
        ]);

        $config = IntegrationConfig::activeIxc();

        $contact->update([
            'ixc_customer_id'      => $validated['ixc_customer_id'],
            'ixc_customer_name'    => $validated['ixc_customer_name'],
            'ixc_document'         => $this->normalizeDocument((string) ($validated['ixc_document'] ?? '')),
            'integration_config_id' => $config?->id,
        ]);

        return response()->json(['ok' => true, 'customer' => $validated]);
    }

    public function unlink(Contact $contact): JsonResponse
    {
        $contact->update([
            'ixc_customer_id'      => null,
            'ixc_customer_name'    => null,
            'ixc_document'         => null,
            'integration_config_id' => null,
        ]);

        return response()->json(['ok' => true]);
    }

    public function contracts(Contact $contact): JsonResponse
    {
        if (! $contact->ixc_customer_id) {
            return response()->json(['error' => 'Contato não vinculado ao IXC.'], 422);
        }

        $config = $contact->integrationConfig ?? IntegrationConfig::activeIxc();

        if (! $config) {
            return response()->json(['error' => 'Integração IXC não encontrada.'], 422);
        }

        $client  = new IxcClient($config);
        $result  = $client->getContratos((int) $contact->ixc_customer_id);
        $contratos = $result['registros'] ?? [];

        if (! is_array($contratos)) {
            $contratos = [];
        }

        // Only show active contracts.
        $contratos = array_values(array_filter($contratos, fn ($c) => ($c['status'] ?? '') === 'A'));

        $data = [];
        foreach ($contratos as $contrato) {
            $idContrato = (string) ($contrato['id'] ?? '');
            $login      = $contrato['login'] ?? '';
            $status     = ['online' => false, 'ip' => null, 'since' => null];

            // Prefere buscar por id_contrato; cai para login como fallback.
            if ($idContrato !== '') {
                $radResult = $client->getLoginStatusByContrato($idContrato);
            } elseif ($login !== '') {
                $radResult = $client->getLoginStatusByLogin($login);
            } else {
                $radResult = [];
            }

            $radRegistros = $radResult['registros'] ?? [];

            if (is_array($radRegistros) && ! empty($radRegistros)) {
                $rad    = $radRegistros[0];
                $online = ($rad['online'] ?? '') === 'S';
                $ip     = $online ? (trim((string) ($rad['ip'] ?? '')) ?: null) : null;

                $status = [
                    'online' => $online,
                    'ip'     => $ip,
                    'since'  => $rad['ultima_conexao_inicial'] ?? null,
                ];
            }

            $valor = (float) ($contrato['valor'] ?? $contrato['valor_plano'] ?? 0);

            $data[] = [
                'id'              => $contrato['id'] ?? '',
                'login'           => $login,
                'status_contrato' => $contrato['status'] ?? '',
                'tipo'            => $contrato['tipo_servico'] ?? ($contrato['tipo'] ?? ''),
                'plano'           => $contrato['contrato'] ?? '',
                'valor'           => $valor > 0 ? 'R$ ' . number_format($valor, 2, ',', '.') : null,
                'velocidade_down' => $contrato['velocidade_download'] ?? ($contrato['velocidade_down'] ?? ($contrato['download'] ?? null)),
                'velocidade_up'   => $contrato['velocidade_upload'] ?? ($contrato['velocidade_up'] ?? ($contrato['upload'] ?? null)),
                'data_ativacao'   => $contrato['data_ativacao'] ?? ($contrato['data_inicio'] ?? ($contrato['created'] ?? null)),
                'online'          => $status['online'],
                'ip'              => $status['ip'],
                'since'           => $status['since'],
            ];
        }

        return response()->json($data);
    }

    public function contractDetails(Contact $contact, string $contractId): JsonResponse
    {
        $config = $contact->integrationConfig ?? IntegrationConfig::activeIxc();

        if (! $config) {
            return response()->json(['error' => 'Integração IXC não encontrada.'], 422);
        }

        $client = new IxcClient($config);

        // Connection data
        $radResult = $client->getLoginStatusByContrato($contractId);
        $rad       = ($radResult['registros'] ?? [])[0] ?? null;
        $connection = null;

        if ($rad) {
            $online     = ($rad['online'] ?? '') === 'S';
            $bytes      = static fn (mixed $b): string => match (true) {
                ($b = (int) $b) >= 1_073_741_824 => round($b / 1_073_741_824, 2) . ' GB',
                $b >= 1_048_576                   => round($b / 1_048_576, 2) . ' MB',
                $b >= 1_024                        => round($b / 1_024, 2) . ' KB',
                default                            => $b . ' B',
            };
            $connection = [
                'online'       => $online,
                'ip'           => trim((string) ($rad['ip'] ?? '')),
                'concentrador' => trim((string) ($rad['concentrador'] ?? '')),
                'tipo_conexao' => trim((string) ($rad['tipo_conexao'] ?? '')),
                'login'        => trim((string) ($rad['login'] ?? '')),
                'senha'        => trim((string) ($rad['senha'] ?? '')),
                'inicio'       => $rad['ultima_conexao_inicial'] ?? null,
                'fim'          => $online ? null : ($rad['ultima_conexao_final'] ?? null),
                'upload'       => ($rad['upload_atual'] ?? 0) > 0 ? $bytes($rad['upload_atual']) : null,
                'download'     => ($rad['download_atual'] ?? 0) > 0 ? $bytes($rad['download_atual']) : null,
            ];
        }

        // Recent invoices — exclude canceled and renegotiated; show only open (A).
        $invoicesResult = $client->getBoletosContrato($contractId);
        $invoices = [];
        foreach ($invoicesResult['registros'] ?? [] as $b) {
            $status      = (string) ($b['status'] ?? '');
            $renegociado = (string) ($b['titulo_renegociado'] ?? 'N');
            if ($status !== 'A' || $renegociado === 'S') {
                continue;
            }
            $valorJuros    = (float) ($b['valor_juros'] ?? 0);
            $valorMulta    = (float) ($b['valor_multa'] ?? 0);
            $valorDesconto = (float) ($b['valor_desconto'] ?? 0);
            $invoices[] = [
                'id'              => $b['id'] ?? '',
                'valor'           => $b['valor'] ?? null,
                'data_vencimento' => $b['data_vencimento'] ?? null,
                'data_emissao'    => $b['data_emissao'] ?? ($b['data_lancamento'] ?? null),
                'referencia'      => trim((string) ($b['referencia'] ?? $b['descricao'] ?? $b['observacao'] ?? '')),
                'competencia'     => $b['competencia'] ?? ($b['mes_referencia'] ?? null),
                'nosso_numero'    => trim((string) ($b['nosso_numero'] ?? '')),
                'parcela'         => trim((string) ($b['numero_parcela'] ?? '')),
                'valor_juros'     => $valorJuros > 0 ? number_format($valorJuros, 2, ',', '.') : null,
                'valor_multa'     => $valorMulta > 0 ? number_format($valorMulta, 2, ',', '.') : null,
                'valor_desconto'  => $valorDesconto > 0 ? number_format($valorDesconto, 2, ',', '.') : null,
                'baixa_data'      => $b['baixa_data'] ?? null,
                'status'          => $status,
            ];
        }

        // Central do assinante (login/senha do portal self-service do cliente)
        $centralDoAssinante = null;
        if ($contact->ixc_customer_id) {
            $clienteResult = $client->getCliente((string) $contact->ixc_customer_id);
            $cli = ($clienteResult['registros'] ?? [])[0] ?? null;
            if ($cli) {
                $login = trim((string) ($cli['hotsite_email'] ?? $cli['login_assinante'] ?? $cli['login_central'] ?? ''));
                $senha = trim((string) ($cli['senha'] ?? ''));
                if ($login !== '' || $senha !== '') {
                    $centralDoAssinante = ['login' => $login ?: null, 'senha' => $senha ?: null];
                }
            }
        }

        // Serviços adicionais do contrato (TV, etc.)
        $servicosResult = $client->getServicosContrato($contractId);
        $servicos = [];
        foreach ($servicosResult['registros'] ?? [] as $s) {
            $valorTotal = (float) ($s['valor_total'] ?? $s['valor_unitario'] ?? $s['valor'] ?? 0);
            $servicos[] = [
                'id'     => $s['id'] ?? '',
                'nome'   => trim((string) ($s['descricao'] ?? $s['nome'] ?? '')),
                'tipo'   => trim((string) ($s['tipo'] ?? '')),
                'status' => $s['status'] ?? '',
                'valor'  => $valorTotal > 0 ? 'R$ ' . number_format($valorTotal, 2, ',', '.') : null,
            ];
        }

        // Comodatos (equipamentos em campo)
        $comodatosResult = $client->getComodatosContrato($contractId);
        $comodatos = [];
        foreach ($comodatosResult['registros'] ?? [] as $c) {
            $qtde    = (int) ($c['qtde_saida'] ?? 0);
            $qtdeDev = (int) ($c['qtde_devolvida'] ?? 0);
            $valorUnit    = (float) ($c['valor_unitario'] ?? $c['valor_unit'] ?? 0);
            $valorTotal   = (float) ($c['valor_total'] ?? 0);
            $comodatos[] = [
                'id'              => $c['id'] ?? '',
                'id_produto'      => $c['id_produto'] ?? null,
                'descricao'       => $c['produto'] ?? ($c['descricao'] ?? ($c['nome_produto'] ?? ($c['descricao_produto'] ?? ''))),
                'qtde'            => $qtde,
                'qtde_devolvida'  => $qtdeDev,
                'unidade'         => $c['unidade'] ?? null,
                'valor_unitario'  => $valorUnit > 0 ? number_format($valorUnit, 2, ',', '.') : null,
                'valor_total'     => $valorTotal > 0 ? number_format($valorTotal, 2, ',', '.') : null,
                'id_patrimonio'   => ($c['id_patrimonio'] ?? 0) > 0 ? (string) $c['id_patrimonio'] : null,
                'patrimonio'      => $c['numero_patrimonio'] ?? ($c['n_patrimonio'] ?? ($c['patrimonio'] ?? '')),
                'numero_serie'    => $c['numero_serie'] ?? ($c['n_serie'] ?? ($c['serie'] ?? null)),
                'mac'             => $c['mac'] ?? null,
                'data'            => $c['data'] ?? ($c['data_inicio'] ?? ($c['data_comodato'] ?? null)),
            ];
        }

        return response()->json([
            'connection'        => $connection,
            'invoices'          => array_values($invoices),
            'comodatos'         => array_values($comodatos),
            'servicos'          => array_values($servicos),
            'central_assinante' => $centralDoAssinante,
        ]);
    }

    public function sendBoleto(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->canBeViewedBy($request->user()), 403);

        $validated = $request->validate([
            'invoice_id'      => ['required', 'string'],
            'contract_id'     => ['nullable', 'string'],
            'data_vencimento' => ['nullable', 'string'],
        ]);

        $contact = $conversation->contact;
        $config  = $contact->integrationConfig ?? IntegrationConfig::activeIxc();

        if (! $config) {
            return response()->json(['error' => 'Integração IXC não encontrada.'], 422);
        }

        $client = new IxcClient($config);
        $base64 = $client->getBoleto($validated['invoice_id']);

        if (! $base64) {
            return response()->json(['error' => 'Não foi possível gerar o boleto no IXC.'], 422);
        }

        // Build filename: "Segunda via - {contract} - {DD-MM-YYYY}.pdf"
        $contractPart = $validated['contract_id'] ? 'Contrato ' . $validated['contract_id'] : null;
        $datePart     = null;
        if (! empty($validated['data_vencimento'])) {
            $parsed   = \DateTime::createFromFormat('Y-m-d', $validated['data_vencimento']);
            $datePart = $parsed ? $parsed->format('d-m-Y') : null;
        }
        $parts    = array_filter(['Segunda via', $contractPart, $datePart]);
        $filename = implode(' - ', $parts) . '.pdf';

        $pdfContent = base64_decode($base64);
        $tmpPath    = tempnam(sys_get_temp_dir(), 'boleto_') . '.pdf';
        file_put_contents($tmpPath, $pdfContent);

        try {
            $file    = new UploadedFile($tmpPath, $filename, 'application/pdf', null, true);
            $sender  = app(MessageSender::class);
            $message = $sender->sendAttachment($conversation, $file, null, $request->user());

            if ($message->status === 'failed') {
                return response()->json(['error' => 'Falha ao enviar no WhatsApp. Verifique a integração.'], 422);
            }

            return response()->json(['ok' => true]);
        } finally {
            @unlink($tmpPath);
        }
    }

    public function sendPix(Request $request, Conversation $conversation): JsonResponse
    {
        abort_unless($conversation->canBeViewedBy($request->user()), 403);

        $validated = $request->validate([
            'invoice_id'      => ['required', 'string'],
            'contract_id'     => ['nullable', 'string'],
            'data_vencimento' => ['nullable', 'string'],
        ]);

        $contact = $conversation->contact;
        $config  = $contact->integrationConfig ?? IntegrationConfig::activeIxc();

        if (! $config) {
            return response()->json(['error' => 'Integração IXC não encontrada.'], 422);
        }

        $client = new IxcClient($config);
        $pix    = $client->getPix($validated['invoice_id']);

        if (! $pix) {
            return response()->json(['error' => 'PIX não disponível para esta fatura.'], 422);
        }

        $sender = app(MessageSender::class);

        $contractPart = $validated['contract_id'] ? 'Contrato ' . $validated['contract_id'] : null;
        $datePart     = null;
        if (! empty($validated['data_vencimento'])) {
            $parsed   = \DateTime::createFromFormat('Y-m-d', $validated['data_vencimento']);
            $datePart = $parsed ? 'Venc. ' . $parsed->format('d/m/Y') : null;
        }
        $parts  = array_filter(['*PIX Copia e Cola*', $contractPart, $datePart]);
        $header = implode(' — ', $parts);

        $textMsg = $sender->sendText($conversation, $header . "\n\n" . $pix['codigo'], $request->user());

        // QR code image — use the PNG already returned by IXC (base64).
        if (! empty($pix['qrcode_base64'])) {
            $tmpPath = tempnam(sys_get_temp_dir(), 'pix_qr_') . '.png';
            try {
                file_put_contents($tmpPath, base64_decode($pix['qrcode_base64']));
                $filename = implode(' - ', array_filter(['QR Code PIX', $contractPart, $datePart ? str_replace('Venc. ', '', $datePart) : null])) . '.png';
                $file     = new UploadedFile($tmpPath, $filename, 'image/png', null, true);
                $sender->sendAttachment($conversation, $file, null, $request->user());
            } finally {
                @unlink($tmpPath);
            }
        }

        if ($textMsg->status === 'failed') {
            return response()->json(['error' => 'Falha ao enviar no WhatsApp. Verifique a integração.'], 422);
        }

        return response()->json(['ok' => true]);
    }

    private function normalizeDocument(string $document): ?string
    {
        $digits = preg_replace('/\D+/', '', $document) ?: '';

        return $digits !== '' ? $digits : null;
    }
}
