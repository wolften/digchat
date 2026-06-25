<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->foreignId('channel_id')->nullable()->after('contact_id')->constrained('channels')->nullOnDelete();
        });

        // Associa conversas existentes ao primeiro canal WhatsApp migrado
        $channelId = DB::table('channels')->where('type', 'whatsapp')->value('id');
        if ($channelId) {
            DB::table('conversations')->whereNull('channel_id')->update(['channel_id' => $channelId]);
        }
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropForeign(['channel_id']);
            $table->dropColumn('channel_id');
        });
    }
};
