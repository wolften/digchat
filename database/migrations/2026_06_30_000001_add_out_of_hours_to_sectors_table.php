<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sectors', function (Blueprint $table) {
            $table->boolean('out_of_hours_enabled')->default(false)->after('is_active');
            $table->text('out_of_hours_message')->nullable()->after('out_of_hours_enabled');
        });
    }

    public function down(): void
    {
        Schema::table('sectors', function (Blueprint $table) {
            $table->dropColumn(['out_of_hours_enabled', 'out_of_hours_message']);
        });
    }
};
