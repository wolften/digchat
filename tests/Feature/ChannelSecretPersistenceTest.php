<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ChannelSecretPersistenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_updating_telegram_channel_with_blank_bot_token_keeps_current_token(): void
    {
        Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => true], 200)]);

        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $channel = Channel::create([
            'type' => Channel::TYPE_TELEGRAM,
            'name' => 'Suporte Telegram',
            'config' => [
                'bot_token' => 'original-bot-token',
                'webhook_secret' => 'original-secret',
            ],
            'is_active' => true,
        ]);

        $response = $this->actingAs($admin)->put(route('canais.update', $channel), [
            'type' => 'telegram',
            'name' => 'Suporte Telegram Renomeado',
            'is_active' => true,
            'config' => [
                'bot_token' => '',
                'webhook_secret' => '',
                'webhook_base_url' => '',
            ],
        ]);

        $response->assertSessionHasNoErrors();
        $response->assertRedirect(route('canais.index'));

        $channel->refresh();
        $this->assertSame('Suporte Telegram Renomeado', $channel->name);
        $this->assertSame('original-bot-token', $channel->config['bot_token']);
        $this->assertSame('original-secret', $channel->config['webhook_secret']);
    }

    public function test_update_flashes_warning_when_telegram_webhook_registration_fails(): void
    {
        Http::fake(['api.telegram.org/*' => Http::response([
            'ok' => false,
            'description' => 'Bad Request: bad webhook: HTTPS url must be provided for webhook',
        ], 400)]);

        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $channel = Channel::create([
            'type' => Channel::TYPE_TELEGRAM,
            'name' => 'Suporte Telegram',
            'config' => ['bot_token' => 'original-bot-token'],
            'is_active' => true,
        ]);

        $response = $this->actingAs($admin)->put(route('canais.update', $channel), [
            'type' => 'telegram',
            'name' => 'Suporte Telegram',
            'is_active' => true,
            'config' => [
                'bot_token' => '',
                'webhook_base_url' => '',
            ],
        ]);

        $response->assertRedirect(route('canais.index'));
        $response->assertSessionHas('warning');
        $this->assertStringContainsString(
            'HTTPS url must be provided',
            session('warning'),
        );
    }

    public function test_creating_telegram_channel_without_bot_token_still_fails_validation(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $response = $this->actingAs($admin)->post(route('canais.store'), [
            'type' => 'telegram',
            'name' => 'Novo bot',
            'is_active' => true,
            'config' => [
                'bot_token' => '',
            ],
        ]);

        $response->assertSessionHasErrors('config.bot_token');
        $this->assertDatabaseCount('channels', 0);
    }

    public function test_updating_whatsapp_channel_with_blank_secrets_keeps_current_values(): void
    {
        $admin = User::factory()->create(['role' => User::ROLE_ADMIN]);

        $channel = Channel::create([
            'type' => Channel::TYPE_WHATSAPP,
            'name' => 'WhatsApp Suporte',
            'config' => [
                'access_token' => 'original-access-token',
                'app_secret' => 'original-app-secret',
                'verify_token' => 'original-verify-token',
                'phone_number_id' => '123456789',
                'api_version' => 'v21.0',
            ],
            'is_active' => true,
        ]);

        $response = $this->actingAs($admin)->put(route('canais.update', $channel), [
            'type' => 'whatsapp',
            'name' => 'WhatsApp Suporte',
            'is_active' => true,
            'config' => [
                'access_token' => '',
                'app_secret' => '',
                'verify_token' => '',
                'phone_number_id' => '999999999',
                'api_version' => 'v21.0',
            ],
        ]);

        $response->assertSessionHasNoErrors();

        $channel->refresh();
        $this->assertSame('999999999', $channel->config['phone_number_id']);
        $this->assertSame('original-access-token', $channel->config['access_token']);
        $this->assertSame('original-app-secret', $channel->config['app_secret']);
        $this->assertSame('original-verify-token', $channel->config['verify_token']);
    }
}
