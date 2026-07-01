<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProfileColorThemeUpdateRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'color_theme' => ['required', 'string', Rule::in(User::COLOR_THEMES)],
        ];
    }
}