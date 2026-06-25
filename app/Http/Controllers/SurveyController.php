<?php

namespace App\Http\Controllers;

use App\Models\Survey;
use App\Models\SurveyAnswer;
use App\Models\SurveyQuestion;
use App\Models\SurveyResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SurveyController extends Controller
{
    public function index(): Response
    {
        $surveys = Survey::withCount(['questions', 'completedResponses'])
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Survey $s) => [
                'id'                        => $s->id,
                'name'                      => $s->name,
                'description'               => $s->description,
                'is_active'                 => $s->is_active,
                'questions_count'           => $s->questions_count,
                'completed_responses_count' => $s->completed_responses_count,
                'created_at'                => $s->created_at?->toIso8601String(),
            ]);

        return Inertia::render('Pesquisas/Index', [
            'surveys' => $surveys,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Pesquisas/Create');
    }

    public function show(Survey $survey): Response
    {
        $survey->loadCount(['questions', 'responses', 'completedResponses']);
        $survey->load(['questions' => fn ($q) => $q->orderBy('position')]);

        return Inertia::render('Pesquisas/Show', [
            'survey' => [
                'id'                        => $survey->id,
                'name'                      => $survey->name,
                'description'               => $survey->description,
                'is_active'                 => $survey->is_active,
                'thank_you_message'         => $survey->thank_you_message,
                'questions_count'           => $survey->questions_count,
                'responses_count'           => $survey->responses_count,
                'completed_responses_count' => $survey->completed_responses_count,
                'questions'                 => $survey->questions->map(fn (SurveyQuestion $q) => [
                    'id'       => $q->id,
                    'text'     => $q->text,
                    'position' => $q->position,
                    'options'  => $q->options ?? [],
                ]),
                'created_at' => $survey->created_at?->toIso8601String(),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name'                          => ['required', 'string', 'max:255'],
            'description'                   => ['nullable', 'string', 'max:500'],
            'is_active'                     => ['boolean'],
            'thank_you_message'             => ['nullable', 'string', 'max:255'],
            'questions'                     => ['present', 'array', 'max:20'],
            'questions.*.text'              => ['required', 'string', 'max:500'],
            'questions.*.options'           => ['present', 'array', 'min:1', 'max:10'],
            'questions.*.options.*.id'      => ['required', 'string', 'max:50'],
            'questions.*.options.*.label'   => ['required', 'string', 'max:100'],
        ]);

        $survey = DB::transaction(function () use ($validated, $request): Survey {
            $survey = Survey::create([
                'name'              => $validated['name'],
                'description'       => $validated['description'] ?? null,
                'is_active'         => $validated['is_active'] ?? false,
                'thank_you_message' => $validated['thank_you_message'] ?? 'Obrigado pela sua avaliação! 🙏',
                'created_by'        => $request->user()->id,
            ]);

            foreach (($validated['questions'] ?? []) as $position => $q) {
                $survey->questions()->create([
                    'text'     => $q['text'],
                    'position' => $position,
                    'options'  => $q['options'],
                ]);
            }

            return $survey;
        });

        return redirect()->route('pesquisas.show', $survey)->with('success', 'Pesquisa criada com sucesso.');
    }

    public function update(Request $request, Survey $survey): RedirectResponse
    {
        $validated = $request->validate([
            'name'              => ['required', 'string', 'max:255'],
            'description'       => ['nullable', 'string', 'max:500'],
            'is_active'         => ['boolean'],
            'thank_you_message' => ['nullable', 'string', 'max:255'],
        ]);

        $survey->update($validated);

        return back()->with('success', 'Pesquisa atualizada.');
    }

    public function syncQuestions(Request $request, Survey $survey): RedirectResponse
    {
        $validated = $request->validate([
            'questions'                     => ['present', 'array', 'max:20'],
            'questions.*.text'              => ['required', 'string', 'max:500'],
            'questions.*.options'           => ['present', 'array', 'min:1', 'max:10'],
            'questions.*.options.*.id'      => ['required', 'string', 'max:50'],
            'questions.*.options.*.label'   => ['required', 'string', 'max:100'],
        ]);

        DB::transaction(function () use ($survey, $validated): void {
            $survey->questions()->delete();

            foreach (($validated['questions'] ?? []) as $position => $q) {
                $survey->questions()->create([
                    'text'     => $q['text'],
                    'position' => $position,
                    'options'  => $q['options'],
                ]);
            }
        });

        return back()->with('success', 'Questões atualizadas.');
    }

    public function destroy(Survey $survey): RedirectResponse
    {
        $survey->delete();

        return redirect()->route('pesquisas.index')->with('success', 'Pesquisa excluída.');
    }

    /** Returns stats + individual responses for a survey (JSON). */
    public function responses(Survey $survey): JsonResponse
    {
        $questions = $survey->questions()->get();

        $stats = $questions->map(function (SurveyQuestion $question) {
            $answers = SurveyAnswer::where('survey_question_id', $question->id)->get();

            $distribution = $answers
                ->groupBy('option_id')
                ->map(fn ($group) => [
                    'option_id'    => $group->first()->option_id,
                    'option_label' => $group->first()->option_label,
                    'count'        => $group->count(),
                ])
                ->values();

            return [
                'question_id'   => $question->id,
                'question_text' => $question->text,
                'options'       => $question->options ?? [],
                'total'         => $answers->count(),
                'distribution'  => $distribution,
            ];
        });

        $totals = $survey->responses()
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        $recent = $survey->completedResponses()
            ->with('contact:id,name,wa_id')
            ->orderByDesc('completed_at')
            ->limit(50)
            ->get()
            ->map(fn ($r) => [
                'id'              => $r->id,
                'contact_name'    => $r->contact?->displayName() ?? '—',
                'contact_wa_id'   => $r->contact?->wa_id,
                'completed_at'    => $r->completed_at?->toIso8601String(),
            ]);

        return response()->json([
            'stats'   => $stats,
            'totals'  => $totals,
            'recent'  => $recent,
        ]);
    }

    /** Returns individual Q&A for a single SurveyResponse. */
    public function responseDetail(SurveyResponse $response): JsonResponse
    {
        $response->load(['contact:id,name,wa_id', 'answers.question']);

        $answers = $response->answers->sortBy('survey_question_id')->map(fn ($a) => [
            'question_text' => $a->question?->text ?? '—',
            'option_label'  => $a->option_label ?? '—',
        ])->values();

        return response()->json([
            'contact_name'  => $response->contact?->displayName() ?? '—',
            'contact_wa_id' => $response->contact?->wa_id,
            'completed_at'  => $response->completed_at?->toIso8601String(),
            'answers'       => $answers,
        ]);
    }
}
