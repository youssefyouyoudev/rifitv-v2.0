<?php

namespace Database\Seeders;

use App\Services\OfficialFixtureImportService;
use Illuminate\Database\Seeder;

class ProductionSeason2026Seeder extends Seeder
{
    public function run(OfficialFixtureImportService $importer): void
    {
        $importer->import('2026-27');
    }
}
