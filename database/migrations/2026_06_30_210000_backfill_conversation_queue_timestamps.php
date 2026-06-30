<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('conversations')
            ->where('status', 'queued')
            ->whereNull('queued_at')
            ->update(['queued_at' => DB::raw('COALESCE(updated_at, created_at)')]);

        DB::table('conversations')
            ->whereNull('queued_at')
            ->whereNotNull('first_response_at')
            ->whereColumn('first_response_at', '>', 'created_at')
            ->update(['queued_at' => DB::raw('created_at')]);
    }

    public function down(): void
    {
        // Dados históricos inferidos; não revertemos para evitar perda de métricas.
    }
};