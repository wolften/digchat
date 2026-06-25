<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            // Remove unique index on wa_id — com múltiplos canais, o mesmo ID pode
            // aparecer em plataformas diferentes. A unicidade agora é (wa_id, channel_id).
            $table->dropUnique(['wa_id']);
            $table->foreignId('channel_id')->nullable()->after('meta')->constrained('channels')->nullOnDelete();
        });

        // Associa contatos existentes ao primeiro canal WhatsApp migrado
        $channelId = DB::table('channels')->where('type', 'whatsapp')->value('id');
        if ($channelId) {
            DB::table('contacts')->whereNull('channel_id')->update(['channel_id' => $channelId]);
        }
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropForeign(['channel_id']);
            $table->dropColumn('channel_id');
            $table->string('wa_id')->unique()->change();
        });
    }
};
