import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, "../src/routes/_student.courses.$courseId.tsx");

let content = readFileSync(filePath, "utf-8");

// Insert ratingDistribution useMemo right before const totalLessons = modules...
const targetMemoSpot = `  const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);`;

const memoCode = `  // Calculate actual rating distribution percentages from loaded database reviews
  const ratingDistribution = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let total = 0;
    
    reviews.forEach((r) => {
      const score = Math.round(Number(r.satisfaction_score || 0));
      if (score >= 1 && score <= 5) {
        counts[score as 5 | 4 | 3 | 2 | 1]++;
        total++;
      }
    });

    return {
      5: total > 0 ? Math.round((counts[5] / total) * 100) : 0,
      4: total > 0 ? Math.round((counts[4] / total) * 100) : 0,
      3: total > 0 ? Math.round((counts[3] / total) * 100) : 0,
      2: total > 0 ? Math.round((counts[2] / total) * 100) : 0,
      1: total > 0 ? Math.round((counts[1] / total) * 100) : 0,
    };
  }, [reviews]);

  const totalLessons = modules.reduce((a, m) => a + m.lessons.length, 0);`;

content = content.replace(targetMemoSpot, memoCode);

// Replace hardcoded rating bars
const oldRatingBars = `                  <RatingBar label="5" pct={72} />
                  <RatingBar label="4" pct={18} />
                  <RatingBar label="3" pct={7} />
                  <RatingBar label="2" pct={2} />
                  <RatingBar label="1" pct={1} />`;

const newRatingBars = `                  <RatingBar label="5" pct={ratingDistribution[5]} />
                  <RatingBar label="4" pct={ratingDistribution[4]} />
                  <RatingBar label="3" pct={ratingDistribution[3]} />
                  <RatingBar label="2" pct={ratingDistribution[2]} />
                  <RatingBar label="1" pct={ratingDistribution[1]} />`;

content = content.replace(oldRatingBars, newRatingBars);

writeFileSync(filePath, content, "utf-8");
console.log("✅ Successfully patched course details page rating distribution bars!");
