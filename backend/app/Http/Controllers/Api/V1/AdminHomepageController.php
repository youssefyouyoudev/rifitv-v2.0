<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\HomepageRequest;
use App\Http\Resources\HomepageSectionResource;
use App\Models\HomepageSection;
use App\Services\HomepageService;

class AdminHomepageController extends Controller
{
    public function show()
    {
        return HomepageSectionResource::collection(HomepageSection::query()->orderBy('sort_order')->get());
    }

    public function update(HomepageRequest $request, HomepageService $service)
    {
        $service->update($request->validated('sections'), $request->user());

        return HomepageSectionResource::collection(HomepageSection::query()->orderBy('sort_order')->get());
    }
}
