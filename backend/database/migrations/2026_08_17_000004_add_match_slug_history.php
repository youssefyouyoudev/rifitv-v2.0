<?php

use App\Models\GameMatch;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('matches', function (Blueprint $table): void {
            $table->json('legacy_slugs')->nullable()->after('slug');
        });

        $timezone = (string) config('rifitv.display_timezone', 'Africa/Casablanca');

        GameMatch::withTrashed()
            ->with(['homeTeam', 'awayTeam'])
            ->orderBy('id')
            ->chunkById(100, function ($matches) use ($timezone): void {
                foreach ($matches as $match) {
                    $legacy = array_values(array_unique(array_filter(array_merge($match->legacy_slugs ?? [], [$match->slug]))));
                    $date = $match->kickoff_at
                        ? Carbon::parse($match->kickoff_at)->timezone($timezone)->toDateString()
                        : ($match->scheduled_date?->toDateString() ?? 'tbc');
                    $base = Str::slug(Str::ascii("{$match->homeTeam->name} vs {$match->awayTeam->name} {$date}"));
                    $candidate = $base;
                    $counter = 2;

                    while (GameMatch::withTrashed()->where('slug', $candidate)->where('id', '!=', $match->id)->exists()) {
                        $candidate = "{$base}-{$counter}";
                        $counter++;
                    }

                    GameMatch::withTrashed()->whereKey($match->id)->update([
                        'slug' => $candidate,
                        'legacy_slugs' => json_encode($legacy, JSON_THROW_ON_ERROR),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('matches', function (Blueprint $table): void {
            $table->dropColumn('legacy_slugs');
        });
    }
};
