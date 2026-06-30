<?php

namespace Tests\Unit;

use App\Models\BusinessHour;
use App\Models\Sector;
use App\Services\BusinessHoursService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class BusinessHoursServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.timezone' => 'America/Sao_Paulo']);
    }

    public function test_is_open_uses_application_timezone(): void
    {
        BusinessHour::create([
            'sector_id' => null,
            'weekday'   => 2, // Tuesday
            'opens_at'  => '08:00:00',
            'closes_at' => '18:00:00',
            'is_active' => true,
        ]);

        $service = new BusinessHoursService;

        $openAt = Carbon::parse('2026-07-07 17:00:00', 'America/Sao_Paulo');
        $closedAt = Carbon::parse('2026-07-07 19:00:00', 'America/Sao_Paulo');

        $this->assertTrue($service->isOpen(null, $openAt));
        $this->assertFalse($service->isOpen(null, $closedAt));
    }

    public function test_sector_hours_take_priority_over_global(): void
    {
        BusinessHour::create([
            'sector_id' => null,
            'weekday'   => 2,
            'opens_at'  => '08:00:00',
            'closes_at' => '18:00:00',
            'is_active' => true,
        ]);

        $sector = Sector::create(['name' => 'Suporte', 'is_active' => true]);

        BusinessHour::create([
            'sector_id' => $sector->id,
            'weekday'   => 2,
            'opens_at'  => '09:00:00',
            'closes_at' => '12:00:00',
            'is_active' => true,
        ]);

        $service = new BusinessHoursService;
        $at = Carbon::parse('2026-07-07 08:30:00', 'America/Sao_Paulo');

        $this->assertTrue($service->isOpen(null, $at));
        $this->assertFalse($service->isOpen($sector->id, $at));
    }

    public function test_missing_day_configuration_is_treated_as_open(): void
    {
        $service = new BusinessHoursService;
        $at = Carbon::parse('2026-07-07 03:00:00', 'America/Sao_Paulo');

        $this->assertTrue($service->isOpen(null, $at));
    }
}