<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->string('ixc_customer_id', 50)->nullable()->after('meta');
            $table->string('ixc_customer_name')->nullable()->after('ixc_customer_id');
            $table->foreignId('integration_config_id')
                ->nullable()
                ->constrained('integration_configs')
                ->nullOnDelete()
                ->after('ixc_customer_name');
        });
    }

    public function down(): void
    {
        Schema::table('contacts', function (Blueprint $table) {
            $table->dropForeign(['integration_config_id']);
            $table->dropColumn(['ixc_customer_id', 'ixc_customer_name', 'integration_config_id']);
        });
    }
};
