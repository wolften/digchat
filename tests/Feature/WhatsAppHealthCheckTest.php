<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\User;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WhatsAppHealthCheckTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_check_ok_when_read_and_messaging_are_granted(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::sequence()
                ->push([
                    'id' => '123456789',
                    'display_phone_number' => '+55 11 99999-9999',
                    'verified_name' => 'Empresa',
                ], 200)
                ->push(['error' => ['message' => '(#100) Invalid parameter', 'code' => 100]], 400)
                ->push(['error' => ['message' => '(#100) Invalid parameter', 'code' => 100]], 400),
        ]);

        $service = new WhatsAppService([
            'access_token' => 'valid-token',
            'phone_number_id' => '123456789',
            'api_version' => 'v21.0',
        ]);

        $result = $service->healthCheck();

        $this->assertSame('ok', $result['status']);
        $this->assertSame('granted', $result['details']['messaging_probe']);
    }

    public function test_health_check_warns_when_read_works_but_messaging_is_denied(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::sequence()
                ->push([
                    'id' => '123456789',
                    'display_phone_number' => '+55 11 99999-9999',
                    'verified_name' => 'Empresa',
                ], 200)
                ->push(['error' => ['message' => '(#100) Invalid parameter', 'code' => 100]], 400)
                ->push([
                    'error' => [
                        'message' => '(#131005) Access denied',
                        'type' => 'OAuthException',
                        'code' => 131005,
                    ],
                ], 403),
        ]);

        $service = new WhatsAppService([
            'access_token' => 'read-only-token',
            'phone_number_id' => '123456789',
            'api_version' => 'v21.0',
        ]);

        $result = $service->healthCheck();

        $this->assertSame('warning', $result['status']);
        $this->assertSame('Leitura OK, envio bloqueado', $result['title']);
        $this->assertSame('denied', $result['details']['messaging_probe']);
        $this->assertSame(131005, $result['details']['messaging_meta_code']);
        $this->assertStringContainsString('whatsapp_business_messaging', $result['message']);
    }

    public function test_health_check_warns_for_sandbox_test_number(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::sequence()
                ->push([
                    'id' => '123456789',
                    'display_phone_number' => '+1 555-637-2453',
                    'verified_name' => 'Test Number',
                ], 200)
                ->push(['error' => ['message' => '(#100) Invalid parameter', 'code' => 100]], 400)
                ->push([
                    'error' => [
                        'message' => '(#131030) Recipient phone number not in allowed list',
                        'code' => 131030,
                    ],
                ], 400),
        ]);

        $service = new WhatsAppService([
            'access_token' => 'sandbox-token',
            'phone_number_id' => '123456789',
            'api_version' => 'v21.0',
        ]);

        $result = $service->healthCheck();

        $this->assertSame('warning', $result['status']);
        $this->assertSame('Leitura OK, envio restrito', $result['title']);
        $this->assertSame('restricted', $result['details']['messaging_probe']);
        $this->assertTrue($result['details']['sandbox_test_number']);
        $this->assertStringContainsString('lista de destinatários', $result['message']);
    }

    public function test_channel_test_endpoint_returns_warning_status(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::sequence()
                ->push([
                    'id' => '123456789',
                    'display_phone_number' => '+1 555-637-2453',
                    'verified_name' => 'Test Number',
                ], 200)
                ->push(['error' => ['message' => '(#100) Invalid parameter', 'code' => 100]], 400)
                ->push([
                    'error' => [
                        'message' => '(#131005) Access denied',
                        'type' => 'OAuthException',
                        'code' => 131005,
                    ],
                ], 403),
        ]);

        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $channel = Channel::create([
            'name' => 'WhatsApp',
            'type' => Channel::TYPE_WHATSAPP,
            'config' => [
                'phone_number_id' => '123456789',
                'access_token' => 'read-only-token',
                'api_version' => 'v21.0',
            ],
            'is_active' => true,
        ]);

        $this->actingAs($admin)
            ->postJson(route('canais.test', $channel))
            ->assertOk()
            ->assertJsonPath('status', 'warning')
            ->assertJsonPath('title', 'Leitura OK, envio bloqueado')
            ->assertJsonPath('details.messaging_probe', 'denied');
    }
}