<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_save_auto_close_settings(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)
            ->post('/configuracoes/sistema', [
                'app_name' => 'DigChat',
                'notify_customer_on_transfer' => '1',
                'auto_close_inactive_conversations_enabled' => '1',
                'auto_close_inactive_conversations_minutes' => 25,
            ])
            ->assertRedirect();

        $this->assertSame('1', AppSetting::get('auto_close_inactive_conversations_enabled'));
        $this->assertSame('25', AppSetting::get('auto_close_inactive_conversations_minutes'));
    }

    public function test_admin_can_run_whatsapp_health_check(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response([
                'id' => '1234567890',
                'display_phone_number' => '+55 47 99999-0000',
                'verified_name' => 'DigChat',
            ], 200),
        ]);

        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)
            ->postJson('/configuracoes/whatsapp/health', [
                'whatsapp_access_token' => 'token-ok',
                'whatsapp_phone_number_id' => '1234567890',
                'whatsapp_api_version' => 'v21.0',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('title', 'Conexão ativa')
            ->assertJsonPath('details.display_phone_number', '+55 47 99999-0000');
    }

    public function test_whatsapp_health_check_diagnoses_invalid_or_expired_token(): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response([
                'error' => [
                    'message' => 'Error validating access token: Session has expired',
                    'type' => 'OAuthException',
                    'code' => 190,
                    'fbtrace_id' => 'ABC123',
                ],
            ], 401),
        ]);

        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $this->actingAs($admin)
            ->postJson('/configuracoes/whatsapp/health', [
                'whatsapp_access_token' => 'expired-token',
                'whatsapp_phone_number_id' => '1234567890',
                'whatsapp_api_version' => 'v21.0',
            ])
            ->assertOk()
            ->assertJsonPath('status', 'error')
            ->assertJsonPath('title', 'Token inválido ou expirado')
            ->assertJsonPath('details.http_status', 401)
            ->assertJsonPath(
                'message',
                'WhatsApp recusou a autenticação: token inválido ou expirado. Gere um novo token permanente de System User com permissão whatsapp_business_messaging, salve em Configurações e rode o teste de conexão novamente.',
            );
    }
}
