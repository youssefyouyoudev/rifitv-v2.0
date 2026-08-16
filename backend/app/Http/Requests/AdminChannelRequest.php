<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AdminChannelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->hasPermission('streams.manage') ?? false;
    }

    public function rules(): array
    {
        $id = $this->route('channel')?->id ?? $this->route('channel');

        return [
            'name' => ['required', 'string', 'max:160'],
            'slug' => ['nullable', 'string', 'max:180', 'unique:channels,slug,'.$id],
            'logo_path' => ['nullable', 'string', 'max:255'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'language' => ['nullable', 'string', 'max:32'],
            'category' => ['nullable', 'string', 'max:48'],
            'active' => ['sometimes', 'boolean'],
            'favorite' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
