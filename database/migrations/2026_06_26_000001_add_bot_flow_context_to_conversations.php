<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            if (! Schema::hasColumn('conversations', 'flow_id')) {
                $table->foreignId('flow_id')->nullable()->after('sector_id')
                    ->constrained('flows')->nullOnDelete();
            }

            if (! Schema::hasColumn('conversations', 'current_node_id')) {
                $table->string('current_node_id')->nullable()->after('flow_id');
            }

            if (! Schema::hasColumn('conversations', 'context')) {
                $table->json('context')->nullable()->after('current_node_id');
            }

        });
    }

    public function down(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            if (Schema::hasColumn('conversations', 'context')) {
                $table->dropColumn('context');
            }

            if (Schema::hasColumn('conversations', 'current_node_id')) {
                $table->dropColumn('current_node_id');
            }

            if (Schema::hasColumn('conversations', 'flow_id')) {
                $table->dropForeign(['flow_id']);
                $table->dropColumn('flow_id');
            }
        });
    }
};
