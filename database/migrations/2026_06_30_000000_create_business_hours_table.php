<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('business_hours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sector_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('weekday'); // 0=Domingo … 6=Sábado
            $table->time('opens_at');
            $table->time('closes_at');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('business_hours');
    }
};
