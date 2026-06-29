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
            $table->string('protocol_number', 20)->nullable()->unique()->after('id');
        });

        // Backfill existing conversations
        DB::table('conversations')->orderBy('id')->chunkById(500, function ($rows) {
            foreach ($rows as $row) {
                DB::table('conversations')
                    ->where('id', $row->id)
                    ->update(['protocol_number' => str_pad((string) $row->id, 8, '0', STR_PAD_LEFT)]);
            }
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->string('protocol_number', 20)->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->dropColumn('protocol_number');
        });
    }
};
