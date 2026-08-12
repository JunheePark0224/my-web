# -*- coding: utf-8 -*-
"""업종 매핑 테이블 (v1 MVP — 6개 업종만).

Yelp `categories` 필드는 쉼표로 구분된 태그 문자열이다. 각 태그를 lower/strip한 뒤
아래 매핑 테이블(집합)과 대조한다. 한 업체가 여러 업종에 매핑될 수 있다(다중 매핑 허용).
"""

CATEGORY_LABELS_KO = {
    "cafe": "카페·베이커리",
    "restaurant": "음식점",
    "bar": "주점·나이트라이프",
    "grocery": "식료품·편의",
    "beauty": "뷰티·미용",
    "fitness": "피트니스·액티비티",
}

# 업종코드 -> 대표 Yelp 태그(lowercase) 집합
CATEGORY_MAP = {
    "cafe": {
        "coffee & tea",
        "cafes",
        "bakeries",
        "coffee roasteries",
        "donuts",
        "juice bars & smoothies",
        "desserts",
        "bubble tea",
        "ice cream & frozen yogurt",
        "breakfast & brunch",
        "patisserie/cake shop",
        "creperies",
        "coffee & tea supplies",
        "tea rooms",
    },
    "restaurant": {
        "restaurants",
        "food",
        "food trucks",
        "fast food",
        "pizza",
        "sandwiches",
        "burgers",
        "chinese",
        "mexican",
        "italian",
        "japanese",
        "sushi bars",
        "thai",
        "indian",
        "seafood",
        "steakhouses",
        "diners",
        "buffets",
        "delis",
        "noodles",
        "barbeque",
        "vietnamese",
        "korean",
        "mediterranean",
    },
    "bar": {
        "bars",
        "nightlife",
        "pubs",
        "sports bars",
        "cocktail bars",
        "wine bars",
        "dive bars",
        "lounges",
        "breweries",
        "beer bar",
        "gastropubs",
        "irish pub",
        "karaoke",
        "dance clubs",
        "hookah bars",
        "speakeasies",
    },
    "grocery": {
        "grocery",
        "convenience stores",
        "specialty food",
        "farmers market",
        "butcher",
        "seafood markets",
        "international grocery",
        "organic stores",
        "health markets",
        "ethnic food",
        "wholesale stores",
        "food delivery services",
        "meat shops",
        "cheese shops",
    },
    "beauty": {
        "hair salons",
        "nail salons",
        "beauty & spas",
        "day spas",
        "barbers",
        "makeup artists",
        "eyelash service",
        "waxing",
        "skin care",
        "hair removal",
        "hair extensions",
        "cosmetics & beauty supply",
        "tanning",
        "spas",
        "hair stylists",
        "blow dry/out services",
    },
    "fitness": {
        "gyms",
        "fitness & instruction",
        "yoga",
        "pilates",
        "trainers",
        "boxing",
        "martial arts",
        "dance studios",
        "cardio classes",
        "gymnastics",
        "swimming pools",
        "climbing",
        "barre classes",
        "cycling classes",
        "sports clubs",
    },
}


def map_categories(categories_str):
    """카테고리 문자열 -> 매핑된 업종코드 집합(list, 중복 없음, 순서 무관하나 안정적으로 정렬)."""
    if not categories_str:
        return []
    tags = {t.strip().lower() for t in categories_str.split(",") if t.strip()}
    matched = []
    for code, tagset in CATEGORY_MAP.items():
        if tags & tagset:
            matched.append(code)
    return matched
