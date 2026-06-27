<?php

namespace App\Services\Flow;

use App\Contracts\MessagingChannel;
use App\Models\Conversation;
use App\Models\IntegrationConfig;
use App\Models\Message;
use App\Services\Ixc\IxcClient;
use App\Services\WhatsApp\MessageSender;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

class IxcBotActionRunner
{
    public const HANDLE_SUCCESS = 'success';
    public const HANDLE_FAILURE = 'failure';

    private const ACTION_INVOICE = 'invoice_second_copy';
    private const ACTION_UNLOCK = 'trust_unlock';

    private MessageSender $sender;

    public function __construct(private MessagingChannel $channel)
    {
        $this->sender = new MessageSender($channel);
    }

    /**
     * @param  array<string, mixed>  $node
     */
    public function start(Conversation $conversation, array $node): ?string
    {
        $action = (string) data_get($node, 'data.action', self::ACTION_INVOICE);

        $this->saveState($conversation, [
            'node_id' => (string) $node['id'],
            'action' => $action,
            'stage' => null,
        ]);

        $contact = $conversation->contact;

        if ($contact->ixc_customer_id && $contact->ixc_document) {
            return $this->askDocumentConfirmation($conversation, $node);
        }

        return $this->askDocument($conversation, $node);
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  array<string, mixed>  $rawMessage
     */
    public function handleReply(Conversation $conversation, array $node, ?string $message, array $rawMessage): ?string
    {
        $state = $this->state($conversation);
        $stage = (string) ($state['stage'] ?? '');

        return match ($stage) {
            'confirm_document' => $this->handleDocumentConfirmation($conversation, $node, $message, $rawMessage),
            'ask_document' => $this->handleDocument($conversation, $node, $message),
            'select_customer' => $this->handleCustomerSelection($conversation, $node, $message, $rawMessage),
            'select_contract' => $this->handleContractSelection($conversation, $node, $message, $rawMessage),
            'select_invoice' => $this->handleInvoiceSelection($conversation, $node, $message, $rawMessage),
            default => $this->askDocument($conversation, $node),
        };
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private function askDocumentConfirmation(Conversation $conversation, array $node): ?string
    {
        $document = $this->formatDocument((string) $conversation->contact->ixc_document);
        $message = $this->nodeText(
            $node,
            'confirm_message',
            "O CPF/CNPJ {$document} continua sendo o documento deste atendimento?",
        );

        $this->saveState($conversation, array_merge($this->state($conversation), [
            'stage' => 'confirm_document',
            'document' => $conversation->contact->ixc_document,
            'customer' => [
                'id' => (string) $conversation->contact->ixc_customer_id,
                'name' => (string) $conversation->contact->ixc_customer_name,
            ],
        ]));

        $this->sendButtons($conversation, $message, [
            ['id' => 'yes', 'title' => 'Sim'],
            ['id' => 'no', 'title' => 'Não'],
        ]);

        return null;
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private function askDocument(Conversation $conversation, array $node): ?string
    {
        $this->saveState($conversation, array_merge($this->state($conversation), [
            'stage' => 'ask_document',
        ]));

        $this->sendText($conversation, $this->nodeText(
            $node,
            'document_message',
            'Informe o CPF ou CNPJ do titular para continuar.',
        ));

        return null;
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  array<string, mixed>  $rawMessage
     */
    private function handleDocumentConfirmation(
        Conversation $conversation,
        array $node,
        ?string $message,
        array $rawMessage,
    ): ?string {
        $reply = $this->replyId($rawMessage) ?? mb_strtolower(trim((string) $message));

        if (in_array($reply, ['yes', 'sim', 's'], true)) {
            $state = $this->state($conversation);
            return $this->continueWithCustomer($conversation, $node, $state['customer'] ?? null, (string) ($state['document'] ?? ''));
        }

        if (in_array($reply, ['no', 'nao', 'não', 'n'], true)) {
            return $this->askDocument($conversation, $node);
        }

        return $this->askDocumentConfirmation($conversation, $node);
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private function handleDocument(Conversation $conversation, array $node, ?string $message): ?string
    {
        $document = $this->normalizeDocument((string) $message);

        if (! in_array(strlen($document), [11, 14], true)) {
            $this->sendText($conversation, 'Documento inválido. Envie somente o CPF ou CNPJ do titular.');
            return null;
        }

        $config = $this->resolveConfig($conversation);

        if (! $config) {
            return $this->finish($conversation, 'Nenhuma integração IXC ativa foi encontrada.', self::HANDLE_FAILURE);
        }

        $client = new IxcClient($config);
        $result = $client->searchClienteByDocument($document);
        $customers = $this->normalizeCustomers($result['registros'] ?? []);

        if (count($customers) === 0) {
            return $this->finish(
                $conversation,
                'Não localizei cliente no IXC com esse CPF/CNPJ.',
                self::HANDLE_FAILURE,
            );
        }

        if (count($customers) === 1) {
            return $this->linkAndContinue($conversation, $node, $customers[0], $document, $config);
        }

        $this->saveState($conversation, array_merge($this->state($conversation), [
            'stage' => 'select_customer',
            'document' => $document,
            'customers' => $customers,
        ]));

        $this->sendList(
            $conversation,
            'Encontrei mais de um cliente para este documento. Selecione o cadastro correto.',
            'Clientes',
            array_map(fn (array $customer): array => [
                'id' => 'customer:' . $customer['id'],
                'title' => mb_substr($customer['name'], 0, 24),
                'description' => 'ID ' . $customer['id'],
            ], array_slice($customers, 0, 10)),
        );

        return null;
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  array<string, mixed>  $rawMessage
     */
    private function handleCustomerSelection(
        Conversation $conversation,
        array $node,
        ?string $message,
        array $rawMessage,
    ): ?string {
        $state = $this->state($conversation);
        $customers = $state['customers'] ?? [];
        $selected = $this->selectByReply($customers, $message, $rawMessage, 'customer:');

        if (! $selected) {
            $this->sendText($conversation, 'Não consegui identificar o cliente selecionado. Escolha uma opção da lista.');
            return null;
        }

        $config = $this->resolveConfig($conversation);

        if (! $config) {
            return $this->finish($conversation, 'Nenhuma integração IXC ativa foi encontrada.', self::HANDLE_FAILURE);
        }

        return $this->linkAndContinue($conversation, $node, $selected, (string) ($state['document'] ?? ''), $config);
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  array<string, string>  $customer
     */
    private function linkAndContinue(
        Conversation $conversation,
        array $node,
        array $customer,
        string $document,
        IntegrationConfig $config,
    ): ?string {
        $conversation->contact->update([
            'ixc_customer_id' => $customer['id'],
            'ixc_customer_name' => $customer['name'],
            'ixc_document' => $document,
            'integration_config_id' => $config->id,
        ]);

        return $this->continueWithCustomer($conversation, $node, $customer, $document);
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  array<string, string>|null  $customer
     */
    private function continueWithCustomer(Conversation $conversation, array $node, ?array $customer, string $document): ?string
    {
        if (! $customer || empty($customer['id'])) {
            return $this->finish($conversation, 'Não foi possível confirmar o cliente IXC.', self::HANDLE_FAILURE);
        }

        $config = $this->resolveConfig($conversation);

        if (! $config) {
            return $this->finish($conversation, 'Nenhuma integração IXC ativa foi encontrada.', self::HANDLE_FAILURE);
        }

        $client = new IxcClient($config);
        $result = $client->getContratos((int) $customer['id']);
        $contracts = $this->normalizeContracts($result['registros'] ?? []);

        if (count($contracts) === 0) {
            return $this->finish($conversation, 'Não localizei contratos para este cliente.', self::HANDLE_FAILURE);
        }

        $state = array_merge($this->state($conversation), [
            'document' => $document,
            'customer' => $customer,
            'contracts' => $contracts,
        ]);

        if (count($contracts) === 1) {
            $this->saveState($conversation, $state);
            return $this->continueWithContract($conversation, $node, $contracts[0]);
        }

        $this->saveState($conversation, array_merge($state, [
            'stage' => 'select_contract',
        ]));

        $this->sendList(
            $conversation,
            'Selecione o contrato para continuar.',
            'Contratos',
            array_map(fn (array $contract): array => [
                'id' => 'contract:' . $contract['id'],
                'title' => 'Contrato ' . $contract['id'],
                'description' => mb_substr(trim($contract['label']), 0, 72),
            ], array_slice($contracts, 0, 10)),
        );

        return null;
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  array<string, mixed>  $rawMessage
     */
    private function handleContractSelection(
        Conversation $conversation,
        array $node,
        ?string $message,
        array $rawMessage,
    ): ?string {
        $contracts = $this->state($conversation)['contracts'] ?? [];
        $selected = $this->selectByReply($contracts, $message, $rawMessage, 'contract:');

        if (! $selected) {
            $this->sendText($conversation, 'Não consegui identificar o contrato selecionado. Escolha uma opção da lista.');
            return null;
        }

        return $this->continueWithContract($conversation, $node, $selected);
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  array<string, string>  $contract
     */
    private function continueWithContract(Conversation $conversation, array $node, array $contract): ?string
    {
        $state = array_merge($this->state($conversation), [
            'contract' => $contract,
        ]);
        $this->saveState($conversation, $state);

        $action = (string) ($state['action'] ?? self::ACTION_INVOICE);

        if ($action === self::ACTION_UNLOCK) {
            return $this->executeUnlock($conversation);
        }

        return $this->continueWithInvoiceSelection($conversation, $node, $contract);
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  array<string, string>  $contract
     */
    private function continueWithInvoiceSelection(Conversation $conversation, array $node, array $contract): ?string
    {
        $config = $this->resolveConfig($conversation);

        if (! $config) {
            return $this->finish($conversation, 'Nenhuma integração IXC ativa foi encontrada.', self::HANDLE_FAILURE);
        }

        $client = new IxcClient($config);
        $invoices = $this->normalizeInvoices($client->getFaturasAbertasContrato($contract['id']));

        if (count($invoices) === 0) {
            return $this->finish($conversation, 'Não encontrei faturas abertas para este contrato.', self::HANDLE_FAILURE);
        }

        $state = array_merge($this->state($conversation), [
            'invoices' => $invoices,
        ]);

        if (count($invoices) === 1) {
            $this->saveState($conversation, $state);
            return $this->sendInvoice($conversation, $invoices[0]);
        }

        $this->saveState($conversation, array_merge($state, [
            'stage' => 'select_invoice',
        ]));

        $this->sendList(
            $conversation,
            'Selecione a fatura para receber a segunda via.',
            'Faturas',
            array_map(fn (array $invoice): array => [
                'id' => 'invoice:' . $invoice['id'],
                'title' => $invoice['title'],
                'description' => $invoice['description'],
            ], array_slice($invoices, 0, 10)),
        );

        return null;
    }

    /**
     * @param  array<string, mixed>  $node
     * @param  array<string, mixed>  $rawMessage
     */
    private function handleInvoiceSelection(
        Conversation $conversation,
        array $node,
        ?string $message,
        array $rawMessage,
    ): ?string {
        $invoices = $this->state($conversation)['invoices'] ?? [];
        $selected = $this->selectByReply($invoices, $message, $rawMessage, 'invoice:');

        if (! $selected) {
            $this->sendText($conversation, 'Não consegui identificar a fatura selecionada. Escolha uma opção da lista.');
            return null;
        }

        return $this->sendInvoice($conversation, $selected);
    }

    /**
     * @param  array<string, string>  $invoice
     */
    private function sendInvoice(Conversation $conversation, array $invoice): ?string
    {
        $config = $this->resolveConfig($conversation);

        if (! $config) {
            return $this->finish($conversation, 'Nenhuma integração IXC ativa foi encontrada.', self::HANDLE_FAILURE);
        }

        $client = new IxcClient($config);
        $base64 = $client->getBoleto($invoice['id']);

        if (! $base64) {
            return $this->finish($conversation, 'Não foi possível gerar o boleto no IXC.', self::HANDLE_FAILURE);
        }

        $contract = $this->state($conversation)['contract'] ?? null;
        $filename = implode(' - ', array_filter([
            'Segunda via',
            $contract ? 'Contrato ' . $contract['id'] : null,
            $invoice['due_date_label'] ?? null,
        ])) . '.pdf';

        $pdfMessage = $this->sendBase64Attachment($conversation, $base64, $filename, 'application/pdf');

        if ($pdfMessage?->status === 'failed') {
            return $this->finish($conversation, 'Falha ao enviar o boleto no WhatsApp.', self::HANDLE_FAILURE);
        }

        $pix = $client->getPix($invoice['id']);

        if ($pix) {
            $codigo = ! empty($pix['codigo']) ? $pix['codigo'] : null;
            $hasQr  = ! empty($pix['qrcode_base64']);

            if ($hasQr) {
                $this->sendBase64Attachment($conversation, $pix['qrcode_base64'], 'QR Code PIX.png', 'image/png', $codigo);
            }

            if ($codigo && ! $hasQr) {
                $this->sendText($conversation, "*PIX Copia e Cola*\n\n`" . $codigo . '`');
            }
        }

        return $this->finish($conversation, 'Segunda via enviada com sucesso.', self::HANDLE_SUCCESS, false);
    }

    private function executeUnlock(Conversation $conversation): ?string
    {
        $config = $this->resolveConfig($conversation);
        $state = $this->state($conversation);
        $contract = $state['contract'] ?? [];

        if (! $config) {
            return $this->finish($conversation, 'Nenhuma integração IXC ativa foi encontrada.', self::HANDLE_FAILURE);
        }

        $result = (new IxcClient($config))->unlockTrust((string) ($contract['id'] ?? ''));

        if ($result['ok']) {
            return $this->finish($conversation, 'Desbloqueio de confiança solicitado com sucesso.', self::HANDLE_SUCCESS);
        }

        return $this->finish($conversation, $result['message'], self::HANDLE_FAILURE);
    }

    private function finish(Conversation $conversation, string $message, string $handle, bool $sendMessage = true): string
    {
        if ($sendMessage) {
            $this->sendText($conversation, $message);
        }

        $context = $conversation->context ?? [];
        unset($context['ixc_action']);
        $conversation->forceFill(['context' => $context])->save();

        return $handle;
    }

    /**
     * @param  array<int, array{id: string, title: string}>  $buttons
     */
    private function sendButtons(Conversation $conversation, string $message, array $buttons): void
    {
        $sent = $this->sender->sendButtons($conversation, $message, $buttons);

        if ($sent->status === 'failed') {
            Log::warning('IxcBotActionRunner: falha ao enviar botões', ['conversation_id' => $conversation->id]);
        }
    }

    /**
     * @param  array<int, array{id: string, title: string, description?: string}>  $rows
     */
    private function sendList(Conversation $conversation, string $message, string $buttonText, array $rows): void
    {
        $sent = $this->sender->sendList($conversation, $message, $buttonText, $rows);

        if ($sent->status === 'failed') {
            Log::warning('IxcBotActionRunner: falha ao enviar lista', ['conversation_id' => $conversation->id]);
        }
    }

    private function sendText(Conversation $conversation, string $message): Message
    {
        return $this->sender->sendText($conversation, $message);
    }

    private function sendBase64Attachment(
        Conversation $conversation,
        string $base64,
        string $filename,
        string $mimeType,
        ?string $caption = null,
    ): ?Message {
        $content = $this->decodeBase64($base64);

        if ($content === null) {
            Log::warning('IxcBotActionRunner: anexo base64 inválido', ['conversation_id' => $conversation->id]);
            return null;
        }

        $tmpPath = tempnam(sys_get_temp_dir(), 'ixc_bot_');
        file_put_contents($tmpPath, $content);

        try {
            $file = new UploadedFile($tmpPath, $filename, $mimeType, null, true);
            return $this->sender->sendAttachment($conversation, $file, $caption);
        } finally {
            @unlink($tmpPath);
        }
    }

    private function decodeBase64(string $base64): ?string
    {
        if (str_contains($base64, ',')) {
            $base64 = substr($base64, strpos($base64, ',') + 1);
        }

        $decoded = base64_decode($base64, true);

        return $decoded === false ? null : $decoded;
    }

    private function resolveConfig(Conversation $conversation): ?IntegrationConfig
    {
        return $conversation->contact->integrationConfig ?? IntegrationConfig::activeIxc();
    }

    /**
     * @param  mixed  $customers
     * @return array<int, array{id: string, name: string}>
     */
    private function normalizeCustomers(mixed $customers): array
    {
        if (! is_array($customers)) {
            return [];
        }

        $normalized = [];

        foreach ($customers as $customer) {
            if (! is_array($customer) || empty($customer['id'])) {
                continue;
            }

            $normalized[] = [
                'id' => (string) $customer['id'],
                'name' => trim((string) ($customer['razao'] ?? $customer['fantasia'] ?? 'Cliente IXC')),
            ];
        }

        return $normalized;
    }

    /**
     * @param  mixed  $contracts
     * @return array<int, array{id: string, label: string}>
     */
    private function normalizeContracts(mixed $contracts): array
    {
        if (! is_array($contracts)) {
            return [];
        }

        $normalized = [];

        foreach ($contracts as $contract) {
            if (! is_array($contract) || empty($contract['id'])) {
                continue;
            }

            if (($contract['status'] ?? '') !== 'A') {
                continue;
            }

            $label = trim(implode(' • ', array_filter([
                $contract['descricao_plano'] ?? $contract['plano'] ?? null,
                $contract['login'] ?? null,
                $contract['status'] ?? null,
            ])));

            $normalized[] = [
                'id' => (string) $contract['id'],
                'label' => $label !== '' ? $label : 'Contrato ' . $contract['id'],
            ];
        }

        return $normalized;
    }

    /**
     * @param  mixed  $invoices
     * @return array<int, array{id: string, title: string, description: string, due_date_label: string}>
     */
    private function normalizeInvoices(mixed $invoices): array
    {
        if (! is_array($invoices)) {
            return [];
        }

        $normalized = [];

        foreach ($invoices as $invoice) {
            if (! is_array($invoice) || empty($invoice['id'])) {
                continue;
            }

            $dueDate = (string) ($invoice['data_vencimento'] ?? '');
            $value = (string) ($invoice['valor'] ?? '');
            $dueLabel = $this->formatDate($dueDate);

            $valueFormatted = $value !== '' ? number_format((float) $value, 2, ',', '.') : '';
            $shortDate = $dueDate !== '' ? substr($dueDate, 8, 2) . '/' . substr($dueDate, 5, 2) : $dueLabel;
            $titleBase = 'Venc. ' . $shortDate;
            $titleWithValue = $valueFormatted !== '' ? $titleBase . ' R$ ' . $valueFormatted : $titleBase;

            $normalized[] = [
                'id' => (string) $invoice['id'],
                'title' => mb_substr($titleWithValue, 0, 24),
                'description' => mb_substr(trim('R$ ' . $valueFormatted . ' • ID ' . $invoice['id']), 0, 72),
                'due_date_label' => str_replace('/', '-', $dueLabel),
            ];
        }

        return $normalized;
    }

    /**
     * @param  array<int, array<string, string>>  $items
     * @param  array<string, mixed>  $rawMessage
     * @return array<string, string>|null
     */
    private function selectByReply(array $items, ?string $message, array $rawMessage, string $prefix): ?array
    {
        $replyId = $this->replyId($rawMessage);

        if ($replyId && str_starts_with($replyId, $prefix)) {
            $id = substr($replyId, strlen($prefix));
            foreach ($items as $item) {
                if ((string) ($item['id'] ?? '') === $id) {
                    return $item;
                }
            }
        }

        $digits = preg_replace('/\D+/', '', (string) $message) ?: '';

        foreach ($items as $index => $item) {
            if ((string) ($item['id'] ?? '') === $digits || (string) ($index + 1) === $digits) {
                return $item;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $rawMessage
     */
    private function replyId(array $rawMessage): ?string
    {
        $id = data_get($rawMessage, 'interactive.button_reply.id')
            ?? data_get($rawMessage, 'interactive.list_reply.id');

        return $id !== null ? (string) $id : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function state(Conversation $conversation): array
    {
        return $conversation->context['ixc_action'] ?? [];
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function saveState(Conversation $conversation, array $state): void
    {
        $context = $conversation->context ?? [];
        $context['ixc_action'] = $state;
        $conversation->forceFill(['context' => $context])->save();
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private function nodeText(array $node, string $key, string $fallback): string
    {
        $text = trim((string) data_get($node, "data.{$key}", ''));

        return $text !== '' ? $text : $fallback;
    }

    private function normalizeDocument(string $document): string
    {
        return preg_replace('/\D+/', '', $document) ?: '';
    }

    private function formatDocument(string $document): string
    {
        $digits = $this->normalizeDocument($document);

        if (strlen($digits) === 11) {
            return preg_replace('/(\d{3})(\d{3})(\d{3})(\d{2})/', '$1.$2.$3-$4', $digits) ?: $digits;
        }

        if (strlen($digits) === 14) {
            return preg_replace('/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/', '$1.$2.$3/$4-$5', $digits) ?: $digits;
        }

        return $digits;
    }

    private function formatDate(string $date): string
    {
        $parsed = \DateTime::createFromFormat('Y-m-d', $date);

        return $parsed ? $parsed->format('d/m/Y') : ($date ?: 'sem vencimento');
    }
}
