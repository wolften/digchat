<?php

namespace Tests\Feature;

use App\Contracts\MessagingChannel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Flow;
use App\Models\IntegrationConfig;
use App\Models\Message;
use App\Services\Flow\FlowEngine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class IxcBotActionFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_action_links_customer_selects_contract_and_sends_open_invoice_assets(): void
    {
        $this->fakeInvoiceIxc();

        $channel = new FakeBotChannel;
        $conversation = $this->makeConversation($this->makeFlow('invoice_second_copy'));
        $engine = new FlowEngine($channel);

        $engine->run($conversation, 'oi');
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => 'Informe o CPF ou CNPJ do titular para continuar.',
        ]);

        $engine->run($conversation->fresh(), '123.456.789-01');
        $contractList = $conversation->messages()->where('type', 'interactive')->latest('id')->firstOrFail();
        $this->assertSame(['contract:101', 'contract:102'], array_column($contractList->payload['rows'], 'id'));

        $engine->run($conversation->fresh(), 'Contrato 101', $this->interactive('contract:101', 'Contrato 101'));
        $invoiceList = $conversation->messages()->where('type', 'interactive')->latest('id')->firstOrFail();
        $this->assertSame(['invoice:900', 'invoice:901'], array_column($invoiceList->payload['rows'], 'id'));

        $engine->run($conversation->fresh(), 'Venc. 10/06/2026', $this->interactive('invoice:900', 'Venc. 10/06/2026'));

        $contact = $conversation->contact->fresh();
        $this->assertSame('1', $contact->ixc_customer_id);
        $this->assertSame('Cliente Teste', $contact->ixc_customer_name);
        $this->assertSame('12345678901', $contact->ixc_document);

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'type' => 'document',
            'body' => '[document]',
        ]);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'type' => 'text',
            'body' => "*PIX Copia e Cola*\n\n000201PIXCODE",
        ]);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'type' => 'image',
            'body' => '[image]',
        ]);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'direction' => Message::DIRECTION_OUT,
            'body' => 'Fluxo seguiu por sucesso.',
        ]);
    }

    public function test_invoice_action_reuses_linked_customer_after_document_confirmation(): void
    {
        $this->fakeSingleInvoiceIxc();

        $config = IntegrationConfig::first();
        $contact = Contact::create([
            'wa_id' => '5547999990000',
            'ixc_customer_id' => '1',
            'ixc_customer_name' => 'Cliente Teste',
            'ixc_document' => '12345678901',
            'integration_config_id' => $config->id,
        ]);
        $conversation = $this->makeConversation($this->makeFlow('invoice_second_copy'), $contact);
        $engine = new FlowEngine(new FakeBotChannel);

        $engine->run($conversation, 'oi');
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'type' => 'interactive',
            'body' => 'O CPF/CNPJ 123.456.789-01 continua sendo o documento deste atendimento?',
        ]);

        $engine->run($conversation->fresh(), 'Sim', $this->interactive('yes', 'Sim'));

        $this->assertSame('12345678901', $contact->fresh()->ixc_document);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'type' => 'document',
            'body' => '[document]',
        ]);
    }

    public function test_unlock_action_posts_configured_endpoint_and_follows_success(): void
    {
        $this->fakeUnlockIxc(['type' => 'success', 'message' => 'ok']);

        $conversation = $this->makeLinkedConversation($this->makeFlow('trust_unlock'));
        $engine = new FlowEngine(new FakeBotChannel);

        $engine->run($conversation, 'oi');
        $engine->run($conversation->fresh(), 'Sim', $this->interactive('yes', 'Sim'));

        Http::assertSent(fn (Request $request): bool => str_ends_with(
            $request->url(),
            '/webservice/v1/desbloqueio_confianca',
        ) && $request['id_cliente'] === '1' && $request['id_contrato'] === '101');

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'body' => 'Desbloqueio de confiança solicitado com sucesso.',
        ]);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'body' => 'Fluxo seguiu por sucesso.',
        ]);
    }

    public function test_unlock_action_reports_business_error_and_follows_failure(): void
    {
        $this->fakeUnlockIxc(['type' => 'error', 'message' => 'Contrato bloqueado para desbloqueio.']);

        $conversation = $this->makeLinkedConversation($this->makeFlow('trust_unlock'));
        $engine = new FlowEngine(new FakeBotChannel);

        $engine->run($conversation, 'oi');
        $engine->run($conversation->fresh(), 'Sim', $this->interactive('yes', 'Sim'));

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'body' => 'Contrato bloqueado para desbloqueio.',
        ]);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'body' => 'Fluxo seguiu por falha.',
        ]);
    }

    public function test_unlock_action_reports_missing_configuration(): void
    {
        IntegrationConfig::create([
            'type' => 'ixc',
            'name' => 'IXC',
            'base_url' => 'https://ixc.test',
            'token' => 'token',
            'is_active' => true,
        ]);

        Http::fake([
            'https://ixc.test/webservice/v1/cliente_contrato' => Http::response([
                'registros' => [['id' => '101', 'login' => 'cliente101', 'descricao_plano' => 'Fibra']],
                'total' => '1',
            ]),
        ]);

        $conversation = $this->makeLinkedConversation($this->makeFlow('trust_unlock'));
        $engine = new FlowEngine(new FakeBotChannel);

        $engine->run($conversation, 'oi');
        $engine->run($conversation->fresh(), 'Sim', $this->interactive('yes', 'Sim'));

        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'body' => 'Desbloqueio de confiança não configurado para esta integração IXC.',
        ]);
        $this->assertDatabaseHas('messages', [
            'conversation_id' => $conversation->id,
            'body' => 'Fluxo seguiu por falha.',
        ]);
    }

    private function makeFlow(string $action): Flow
    {
        return Flow::create([
            'name' => 'Fluxo IXC',
            'definition' => [
                'nodes' => [
                    ['id' => 'start', 'type' => 'start', 'data' => []],
                    ['id' => 'ixc', 'type' => 'ixc_action', 'data' => ['action' => $action]],
                    ['id' => 'success', 'type' => 'message', 'data' => ['message' => 'Fluxo seguiu por sucesso.']],
                    ['id' => 'failure', 'type' => 'message', 'data' => ['message' => 'Fluxo seguiu por falha.']],
                ],
                'edges' => [
                    ['source' => 'start', 'target' => 'ixc'],
                    ['source' => 'ixc', 'target' => 'success', 'sourceHandle' => 'success'],
                    ['source' => 'ixc', 'target' => 'failure', 'sourceHandle' => 'failure'],
                ],
            ],
            'is_active' => true,
            'is_default' => true,
        ]);
    }

    private function makeConversation(Flow $flow, ?Contact $contact = null): Conversation
    {
        $contact ??= Contact::create(['wa_id' => '5547999990000']);

        return $contact->conversations()->create([
            'status' => Conversation::STATUS_BOT,
            'flow_id' => $flow->id,
            'last_message_at' => now(),
        ]);
    }

    private function makeLinkedConversation(Flow $flow): Conversation
    {
        $config = IntegrationConfig::first();
        $contact = Contact::create([
            'wa_id' => '5547999990000',
            'ixc_customer_id' => '1',
            'ixc_customer_name' => 'Cliente Teste',
            'ixc_document' => '12345678901',
            'integration_config_id' => $config?->id,
        ]);

        return $this->makeConversation($flow, $contact);
    }

    private function fakeInvoiceIxc(): void
    {
        IntegrationConfig::create([
            'type' => 'ixc',
            'name' => 'IXC',
            'base_url' => 'https://ixc.test',
            'token' => 'token',
            'is_active' => true,
        ]);

        Http::fake(function (Request $request) {
            $url = $request->url();

            if (str_ends_with($url, '/webservice/v1/cliente')) {
                return Http::response([
                    'registros' => [['id' => '1', 'razao' => 'Cliente Teste', 'cnpj_cpf' => '12345678901']],
                    'total' => '1',
                ]);
            }

            if (str_ends_with($url, '/webservice/v1/cliente_contrato')) {
                return Http::response([
                    'registros' => [
                        ['id' => '101', 'login' => 'cliente101', 'descricao_plano' => 'Fibra 600M', 'status' => 'A'],
                        ['id' => '102', 'login' => 'cliente102', 'descricao_plano' => 'Fibra 300M', 'status' => 'A'],
                    ],
                    'total' => '2',
                ]);
            }

            if (str_ends_with($url, '/webservice/v1/fn_areceber')) {
                return Http::response([
                    'registros' => [
                        ['id' => '900', 'status' => 'A', 'titulo_renegociado' => 'N', 'valor' => '100.00', 'data_vencimento' => '2026-06-10'],
                        ['id' => '901', 'status' => 'A', 'titulo_renegociado' => 'N', 'valor' => '150.00', 'data_vencimento' => '2026-06-20'],
                        ['id' => '902', 'status' => 'R', 'titulo_renegociado' => 'N', 'valor' => '80.00', 'data_vencimento' => '2026-05-10'],
                        ['id' => '903', 'status' => 'A', 'titulo_renegociado' => 'S', 'valor' => '70.00', 'data_vencimento' => '2026-05-20'],
                    ],
                    'total' => '4',
                ]);
            }

            if (str_ends_with($url, '/webservice/v1/get_boleto')) {
                return Http::response(base64_encode('%PDF-1.4 boleto'), 200);
            }

            if (str_ends_with($url, '/webservice/v1/get_pix')) {
                return Http::response([
                    'type' => 'success',
                    'pix' => ['qrCode' => ['qrcode' => '000201PIXCODE', 'imagemQrcode' => base64_encode('png')]],
                ]);
            }

            return Http::response([], 404);
        });
    }

    private function fakeSingleInvoiceIxc(): void
    {
        IntegrationConfig::create([
            'type' => 'ixc',
            'name' => 'IXC',
            'base_url' => 'https://ixc.test',
            'token' => 'token',
            'is_active' => true,
        ]);

        Http::fake([
            'https://ixc.test/webservice/v1/cliente_contrato' => Http::response([
                'registros' => [['id' => '101', 'login' => 'cliente101', 'descricao_plano' => 'Fibra']],
                'total' => '1',
            ]),
            'https://ixc.test/webservice/v1/fn_areceber' => Http::response([
                'registros' => [['id' => '900', 'status' => 'A', 'titulo_renegociado' => 'N', 'valor' => '100.00', 'data_vencimento' => '2026-06-10']],
                'total' => '1',
            ]),
            'https://ixc.test/webservice/v1/get_boleto' => Http::response(base64_encode('%PDF-1.4 boleto'), 200),
            'https://ixc.test/webservice/v1/get_pix' => Http::response(['type' => 'error']),
        ]);
    }

    private function fakeUnlockIxc(array $unlockResponse): void
    {
        IntegrationConfig::create([
            'type' => 'ixc',
            'name' => 'IXC',
            'base_url' => 'https://ixc.test',
            'token' => 'token',
            'unlock_endpoint' => 'desbloqueio_confianca',
            'unlock_payload_template' => '{"id_cliente":"{{customer_id}}","id_contrato":"{{contract_id}}","documento":"{{document}}"}',
            'is_active' => true,
        ]);

        Http::fake([
            'https://ixc.test/webservice/v1/cliente_contrato' => Http::response([
                'registros' => [['id' => '101', 'login' => 'cliente101', 'descricao_plano' => 'Fibra']],
                'total' => '1',
            ]),
            'https://ixc.test/webservice/v1/desbloqueio_confianca' => Http::response($unlockResponse),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function interactive(string $id, string $title): array
    {
        return [
            'interactive' => [
                'list_reply' => [
                    'id' => $id,
                    'title' => $title,
                ],
            ],
        ];
    }
}

class FakeBotChannel implements MessagingChannel
{
    private int $nextId = 1;

    public function sendText(string $to, string $body): ?string
    {
        return $this->id();
    }

    public function sendButtons(string $to, string $body, array $buttons, ?string $header = null): ?string
    {
        return $this->id();
    }

    public function sendList(string $to, string $body, string $buttonText, array $rows, ?string $sectionTitle = null): ?string
    {
        return $this->id();
    }

    public function sendFile(string $to, UploadedFile $file, string $type, ?string $caption = null, ?string $filename = null, ?string $forcedMimeType = null): ?string
    {
        return $this->id();
    }

    public function supportsMediaFetch(): bool
    {
        return true;
    }

    public function markAsRead(string $messageId): bool
    {
        return true;
    }

    public function isConfigured(): bool
    {
        return true;
    }

    public function getLastErrorMessage(): ?string
    {
        return null;
    }

    private function id(): string
    {
        return 'fake-' . $this->nextId++;
    }
}
