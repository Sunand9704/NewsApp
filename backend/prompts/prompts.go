package prompts

import "fmt"

const factsPromptTemplate = `Extract clean facts from the input.

Rules:
- Use only explicit statements from input.
- Keep each fact short and clear.
- Return 5 to 8 facts maximum.
- Remove duplicates.
- Do not invent facts.

Return strict JSON:
{"facts":["fact 1","fact 2"]}

Input:
%s`

const gapsPromptTemplate = `Generate missing-context questions from the input facts.

Rules:
- Questions must point to missing verification context.
- Keep each question practical and specific.
- Return 5 to 8 questions maximum.
- Do not answer the question.
- Remove duplicates.

Return strict JSON:
{"gaps":["question 1","question 2"]}

Input:
%s`

const articlePromptTemplate = `Generate one structured article paragraph.

Rules:
- Use facts as primary truth.
- Mention unresolved gaps as context.
- Keep it concise and readable.
- Keep it to one paragraph (around 80-140 words).
- Do not add unknown claims.

Return strict JSON:
{"article":"final paragraph text"}

Facts:
%s

Gaps:
%s`

const headlinesPromptTemplate = `Generate headline options for a news analysis.

Rules:
- Return 3 to 5 distinct headlines.
- Keep each headline concise (max 12 words).
- Focus on strongest verified facts.
- Avoid clickbait and avoid questions.
- Do not invent claims.

Return strict JSON:
{"headlines":["headline 1","headline 2"]}

Facts:
%s

Article:
%s`

const straplinesPromptTemplate = `Generate strapline options for a news analysis.

Rules:
- Return 2 to 4 distinct straplines.
- Each strapline should complement a headline (max 14 words).
- Keep tone factual and editorial.
- Do not invent claims.

Return strict JSON:
{"straplines":["strapline 1","strapline 2"]}

Facts:
%s

Open gaps:
%s

Article:
%s`

func BuildFactsPrompt(text string) string {
	return fmt.Sprintf(factsPromptTemplate, text)
}

func BuildGapsPrompt(facts string) string {
	return fmt.Sprintf(gapsPromptTemplate, facts)
}

func BuildArticlePrompt(facts string, gaps string) string {
	return fmt.Sprintf(articlePromptTemplate, facts, gaps)
}

func BuildHeadlinesPrompt(facts string, article string) string {
	return fmt.Sprintf(headlinesPromptTemplate, facts, article)
}

func BuildStraplinesPrompt(facts string, gaps string, article string) string {
	return fmt.Sprintf(straplinesPromptTemplate, facts, gaps, article)
}
