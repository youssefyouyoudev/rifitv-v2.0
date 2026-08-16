<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AdminTeamRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('teams.manage') ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('team')?->id ?? $this->route('team');

        return [
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180', 'unique:teams,slug,'.$id],
            'short_name' => ['nullable', 'string', 'max:24'],
            'logo_path' => ['nullable', 'string', 'max:255'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'primary_color' => ['nullable', 'string', 'max:16'],
            'active' => ['sometimes', 'boolean'],
            'featured' => ['sometimes', 'boolean'],
        ];
    }
}
