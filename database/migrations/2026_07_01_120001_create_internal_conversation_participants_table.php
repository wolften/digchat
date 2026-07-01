<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('internal_conversation_participants', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('internal_conversation_id');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreign('internal_conversation_id', 'icp_conversation_fk')
                ->references('id')
                ->on('internal_conversations')
                ->cascadeOnDelete();
            $table->timestamp('last_read_at')->nullable();
            $table->timestamps();

            $table->unique(['internal_conversation_id', 'user_id'], 'icp_conversation_user_unique');
            $table->index(['user_id', 'last_read_at'], 'icp_user_read_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('internal_conversation_participants');
    }
};