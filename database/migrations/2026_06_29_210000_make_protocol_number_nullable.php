<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            // O hook `created` do model Conversation seta o valor logo após o INSERT,
            // portanto a coluna pode ser nullable sem perder a integridade dos dados.
            // A restrição NOT NULL quebrava o INSERT antes do hook rodar.
            $table->string('protocol_number', 20)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->string('protocol_number', 20)->nullable(false)->change();
        });
    }
};
