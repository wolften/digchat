<?php

use App\Models\InternalConversation;
use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('internal_messages', function (Blueprint $table) {
            $table->unsignedBigInteger('internal_conversation_id')->nullable()->after('id');
            $table->foreign('internal_conversation_id', 'im_conversation_fk')
                ->references('id')
                ->on('internal_conversations')
                ->cascadeOnDelete();
        });

        $generalId = DB::table('internal_conversations')->insertGetId([
            'type' => InternalConversation::TYPE_GENERAL,
            'last_message_at' => DB::table('internal_messages')->max('created_at'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $activeUserIds = User::query()->where('is_active', true)->pluck('id');
        $now = now();

        foreach ($activeUserIds as $userId) {
            DB::table('internal_conversation_participants')->insert([
                'internal_conversation_id' => $generalId,
                'user_id' => $userId,
                'last_read_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::table('internal_messages')
            ->whereNull('internal_conversation_id')
            ->update(['internal_conversation_id' => $generalId]);

        Schema::table('internal_messages', function (Blueprint $table) {
            $table->unsignedBigInteger('internal_conversation_id')->nullable(false)->change();
            $table->index(['internal_conversation_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('internal_messages', function (Blueprint $table) {
            $table->dropForeign(['internal_conversation_id']);
            $table->dropColumn('internal_conversation_id');
        });
    }
};