import os
import json
import requests
from datetime import datetime, timezone
from collections import defaultdict

USERNAME = "Beresalfred"
JWT = os.environ["DUOLINGO_JWT"]

HEADERS = {
    "Authorization": f"Bearer {JWT}",
    "User-Agent": "Mozilla/5.0 (compatible; personal-site-stats/1.0)",
}

XP_THRESHOLDS = [
    0, 60, 120, 200, 350, 500, 750, 1000, 1500, 2000,
    3000, 4000, 5000, 6000, 8000, 10000, 13000, 16000,
    19000, 22000, 26000, 30000, 35000, 40000, 50000
]

LEAGUE_NAMES = {
    1: "Bronze", 2: "Silver", 3: "Gold", 4: "Pearl",
    5: "Sapphire", 6: "Ruby", 7: "Emerald", 8: "Amethyst",
    9: "Diamond", 10: "Obsidian"
}

def xp_to_level(xp):
    level = 1
    for i, threshold in enumerate(XP_THRESHOLDS):
        if xp >= threshold:
            level = i + 1
    return min(level, 25)

def fetch_user():
    r = requests.get(
        f"https://www.duolingo.com/2017-06-30/users?username={USERNAME}",
        headers=HEADERS,
        timeout=10,
    )
    r.raise_for_status()
    return r.json()["users"][0]

def build_heatmap(xp_gains):
    daily_xp = defaultdict(int)
    for g in xp_gains:
        day = datetime.fromtimestamp(g["time"], tz=timezone.utc).strftime("%Y-%m-%d")
        daily_xp[day] += g["xp"]
    return dict(sorted(daily_xp.items()))

def fetch_stats():
    user = fetch_user()

    course = user.get("courses", [{}])[0]
    course_xp = course.get("xp", 0)
    streak_data = user.get("streakData", {})
    tracking = user.get("trackingProperties", {})

    league_tier = tracking.get("leaderboard_league")

    stats = {
        "streak": user.get("streak", 0),
        "longestStreak": streak_data.get("longestStreak", {}).get("length", 0),
        "streakStart": streak_data.get("currentStreak", {}).get("startDate"),
        "totalXp": user.get("totalXp", 0),
        "xpGoal": user.get("xpGoal", 0),
        "xpGoalMetToday": user.get("xpGoalMetToday", False),
        "hasPlus": user.get("hasPlus", False),
        "weeklyXp": user.get("weeklyXp", 0),
        "course": {
            "title": course.get("title", ""),
            "xp": course_xp,
            "level": xp_to_level(course_xp),
            "crowns": course.get("crowns", 0),
        },
        "league": {
            "tier": league_tier,
            "name": LEAGUE_NAMES.get(league_tier, "Unknown"),
        },
        "heatmap": build_heatmap(user.get("xpGains", [])),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }

    return stats

if __name__ == "__main__":
    stats = fetch_stats()

    with open("duolingo-stats.json", "w") as f:
        json.dump(stats, f, separators=(",", ":"))

    size_kb = len(json.dumps(stats)) / 1024
    print(f"✓ Streak: {stats['streak']} days | XP: {stats['totalXp']:,} | Level: {stats['course']['level']}")
    print(f"✓ League: {stats['league']['name']} | Heatmap days: {len(stats['heatmap'])}")
    print(f"✓ JSON size: {size_kb:.1f} KB")
