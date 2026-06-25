<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->enum('direction', ['in', 'out']);
            $table->string('type')->default('text')->comment('text, image, interactive, template, etc.');
            $table->text('body')->nullable();
            $table->string('wa_message_id')->nullable()->unique();
            $table->string('status')->nullable()->comment('sent, delivered, read, failed');
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->nullOnDelete()
                ->comment('Atendente que enviou; null = bot/cliente');
            $table->json('payload')->nullable()->comment('JSON bruto recebido/enviado');
            $table->timestamps();

            $table->index(['conversation_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
