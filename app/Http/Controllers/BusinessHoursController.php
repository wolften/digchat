<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\BusinessHour;
use App\Models\Sector;
use App\Services\BusinessHoursService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BusinessHoursController extends Controller
{
    public function index(): Response
    {
        $sectors = Sector::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'out_of_hours_enabled', 'out_of_hours_message']);

        $allHours = BusinessHour::orderBy('weekday')->get();

        // Group: 'global' for sector_id=null, sector id (string) otherwise.
        $hoursMap = [];
        foreach ($allHours as $h) {
            $key              = $h->sector_id === null ? 'global' : (string) $h->sector_id;
            $hoursMap[$key][] = [
                'weekday'   => $h->weekday,
                'opens_at'  => substr($h->opens_at, 0, 5),  // "HH:MM"
                'closes_at' => substr($h->closes_at, 0, 5),
                'is_active' => $h->is_active,
            ];
        }

        $businessHours = new BusinessHoursService;
        $now           = now();
        $openStatus    = ['global' => $businessHours->isOpen(null)];

        foreach ($sectors as $sector) {
            $openStatus[(string) $sector->id] = $businessHours->isOpen($sector->id);
        }

        return Inertia::render('Horarios/Index', [
            'sectors'  => $sectors,
            'hoursMap' => $hoursMap,
            'global'   => [
                'out_of_hours_enabled'  => AppSetting::bool('out_of_hours_enabled'),
                'out_of_hours_message'  => AppSetting::get('out_of_hours_message', ''),
            ],
            'timezone'      => config('app.timezone'),
            'currentTime'   => $now->format('H:i'),
            'currentWeekday' => (int) $now->format('w'),
            'openStatus'    => $openStatus,
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'sector_id'              => ['nullable', 'integer', 'exists:sectors,id'],
            'hours'                  => ['required', 'array', 'size:7'],
            'hours.*.weekday'        => ['required', 'integer', 'between:0,6'],
            'hours.*.opens_at'       => ['required', 'date_format:H:i'],
            'hours.*.closes_at'      => ['required', 'date_format:H:i'],
            'hours.*.is_active'      => ['boolean'],
            'out_of_hours_enabled'  => ['boolean'],
            'out_of_hours_message'  => ['nullable', 'string', 'max:1000'],
        ]);

        $sectorId = $validated['sector_id'] ?? null;

        foreach ($validated['hours'] as $row) {
            BusinessHour::updateOrCreate(
                ['sector_id' => $sectorId, 'weekday' => $row['weekday']],
                [
                    'opens_at'  => $row['opens_at'],
                    'closes_at' => $row['closes_at'],
                    'is_active' => $row['is_active'] ?? true,
                ],
            );
        }

        $enabled = (bool) ($validated['out_of_hours_enabled'] ?? false);
        $message = $validated['out_of_hours_message'] ?? '';

        if ($sectorId) {
            Sector::where('id', $sectorId)->update([
                'out_of_hours_enabled' => $enabled,
                'out_of_hours_message' => $message,
            ]);
        } else {
            AppSetting::setMany([
                'out_of_hours_enabled' => $enabled ? '1' : '0',
                'out_of_hours_message' => $message,
            ]);
        }

        return back()->with('success', 'Horários salvos!');
    }
}
