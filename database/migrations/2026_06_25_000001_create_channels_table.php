<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channels', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20)->comment('whatsapp | telegram');
            $table->string('name');
            $table->longText('config')->nullable()->comment('JSON com credenciais do canal');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Migra configuração WhatsApp existente de app_settings → channels
        $settings = DB::table('app_settings')
            ->whereIn('key', [
                'whatsapp_access_token',
                'whatsapp_phone_number_id',
                'whatsapp_api_version',
                'whatsapp_verify_token',
                'whatsapp_app_secret',
                'whatsapp_waba_id',
            ])
            ->pluck('value', 'key');

        if ($settings->isNotEmpty()) {
            DB::table('channels')->insert([
                'type'       => 'whatsapp',
                'name'       => 'WhatsApp Principal',
                'config'     => json_encode([
                    'access_token'    => $settings['whatsapp_access_token'] ?? null,
                    'phone_number_id' => $settings['whatsapp_phone_number_id'] ?? null,
                    'api_version'     => $settings['whatsapp_api_version'] ?? 'v21.0',
                    'verify_token'    => $settings['whatsapp_verify_token'] ?? null,
                    'app_secret'      => $settings['whatsapp_app_secret'] ?? null,
                    'waba_id'         => $settings['whatsapp_waba_id'] ?? null,
                ]),
                'is_active'  => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('channels');
    }
};
