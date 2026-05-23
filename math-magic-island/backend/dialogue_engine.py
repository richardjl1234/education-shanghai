"""
嘟嘟对话引擎 — 模板+参数化混合方案
场景触发 → 模板选择 → 记忆上下文注入 → 生成对话
"""

import random
from typing import Optional

# 嘟嘟的语言风格预设
PREFIXES = ["嘿嘿~ ", "哇！", "嗯... ", "啊！", "嘻嘻~ ", ""]
SUFFIXES = ["~", "！", "呀~", "呢~", "哦！", ""]

# 场景对话模板库
DIALOGUE_TEMPLATES = {
    # ===== 迎接场景 =====
    "greeting_first_time": [
        "嗨！我叫嘟嘟！你叫什么名字呀？",
        "你好你好！我是嘟嘟~ 你终于来啦！你是谁呀？",
        "咦？有人来了！我是嘟嘟，住在蘑菇屋里的小家伙！你叫什么呀？",
    ],
    "greeting_return": [
        "{name}！你来啦！我好想你呀~",
        "{name}{name}！我一直在等你呢！嘿嘿~",
        "哇！{name}回来了！今天我们要去哪里探险呀？",
    ],
    "greeting_streak": [
        "{name}！你已经连续{streak}天来找我玩了！给你一颗大星星★",
        "嘿嘿~ {name}每天都来，我好开心！今天是第{streak}天啦！",
    ],

    # ===== 回顾昨天 =====
    "recall_yesterday": [
        "昨天我们在{zone}玩得好开心！你还记得我们学了什么吗？",
        "昨天{zone}的冒险真有趣！今天我们继续往前走吧~",
        "嘿嘿，昨天{zone}里发生的事我还记得哦！",
    ],
    "recall_struggle": [
        "{name}，昨天{topic}那道题有点难对吧？我回去想了好久，好像有点懂了！今天我们再来试试？",
        "昨天在{topic}那里，乌云遮住了水晶... 但没关系！今天我陪你一起打败它！",
    ],
    "recall_great_day": [
        "昨天你好厉害呀！{topic}的题全都答对了！水晶都发光啦~",
    ],

    # ===== 探索模式 =====
    "explore_start": [
        "好啦！我们现在在{zone}！{name}的爸爸来带路吧~ 看看前面有什么好玩的！",
        "哇，{zone}今天看起来好漂亮！往前走走吧~",
    ],
    "explore_discover": [
        "咦？前面好像有什么东西！闪闪发光的！过去看看？",
        "快看！那里有个谜题！我们一起去解开它吧~",
        "哇！这里藏着一个数学魔法！",
    ],

    # ===== 答题反馈 =====
    "problem_present": [
        "这题是关于{topic}的哦！{name}，我们来试试吧~",
        "来啦来啦！{topic}的挑战！准备好了吗？",
        "嘿嘿，{name}，这道题你会吗？",
    ],
    "correct_first_try": [
        "哇！{name}好厉害！一下子就答对了！水晶闪闪发光★",
        "太棒啦！完全正确！你就是数学小公主！",
        "嘿嘿~ {name}真聪明！这颗水晶给你！",
    ],
    "correct_with_effort": [
        "对了对了！{name}真棒！虽然刚才有点难，但是你做出来啦~",
        "耶！答对了！{name}是不是比昨天进步了？我感觉是的！",
    ],
    "correct_streak_3": [
        "哇哇哇！{name}连对3题了！你是魔法岛最强的小朋友！",
        "天哪！连对3题！{name}，你是不是偷偷练过呀？嘿嘿~",
    ],
    "wrong_first_time": [
        "嗯... 没关系{name}！乌云只是轻轻碰了一下水晶，我们再试试~",
        "哎呀！差一点点！不过嘟嘟第一次也不会呢，我们再来一次好不好？",
        "哦~ 这朵乌云小小的！{name}别急，我们慢慢想~",
    ],
    "wrong_second_time": [
        "唔... 又错了。但是{name}不要怕！来，看看爸爸能不能帮帮我们？",
        "哎呀，乌云变大了一点... 要不要让爸爸给个小提示呀？",
        "嘟嘟也会做错呢！我们请爸爸教教我们好不好？",
    ],
    "wrong_final": [
        "没关系没关系！{name}，这道题先记下来，下次我们再来挑战它！现在先往前走吧~",
        "好啦，这道题可能太难了。{name}别难过，你看水晶还是亮亮的！下次我们一定行！",
    ],

    # ===== L2记忆驱动场景 =====
    "recall_struggle_repeat": [
        "{name}，我记得上次{topic}我们遇到了一朵乌云。这次我有个小魔法——我们一个一个来，慢慢想！",
        "昨天在{topic}上，乌云出现了好几次呢... 但是没关系！今天嘟嘟陪你一起，一个一个打散它们！",
        "嘿嘿，{name}，我昨天回家想了{topic}好久好久！我画了一幅小画，你看完肯定就会了~",
    ],
    "remember_last_time": [
        "{name}，你还记得吗？上次有一道题你也不会，后来你想了想就做出来了！那次的{streak_reminder}，我到现在还记得呢！",
        "嘿嘿~ 上次{name}在{topic}上用了{time_desc}就想出来了！今天肯定更快！",
    ],
    "dudu_learn_together": [
        "{name}，我也想学这道题！你带着我一起做好不好？",
        "等等我！我也要算！{name}你算得比我快，你带我~",
    ],
    "wrong_teach_dudu": [
        "唔... 这道题我也不会。{name}，你能不能教教我呀？",
        "咦？{name}也答错了？嘿嘿，太好了——不对不对... 我是说我们一起研究！",
        "啊，乌云来了... {name}，我们一起去问问爸爸怎么做，然后你讲给我听好不好？",
    ],
    "correct_after_teach": [
        "哇！{name}教完我以后我就懂啦！{name}是嘟嘟的小老师！",
        "嘿嘿！{name}你教会我啦！我现在也会这道题了！给你一朵小花~",
        "小老师好厉害！你讲得比乌云还清楚！下次我还跟你学~",
    ],
    "recall_progress": [
        "{name}，我发现你最近进步了好多！昨天在{topic}上全都答对了，比上周厉害多了！",
        "哇，{name}你知道吗？你最近做{topic}的速度越来越快了！我觉得你都快变成数学小魔法师了~",
    ],
    "memory_encourage": [
        "不要怕{name}！你想想看，昨天你也不会那道题，后来不是做出来了吗？今天也一样！",
        "{name}，记住哦——在数学魔法岛，没有打不败的乌云！嘟嘟永远陪着你~",
    ],

    # ===== Boss战 =====
    "boss_start": [
        "哇！前面有一只数学大乌云！{name}和爸爸要一起打败它！",
        "Boss出现啦！这次需要{name}和爸爸轮流帮忙！准备好了吗？",
    ],
    "boss_parent_turn": [
        "现在是爸爸的回合！爸爸加油，给{name}做个榜样~",
    ],
    "boss_child_turn": [
        "轮到{name}了！爸爸刚才好厉害，现在看你的啦~",
    ],

    # ===== 结算场景 =====
    "session_summary": [
        "今天我们一共解了{total}道题，对了{correct}道！{name}棒棒的！",
        "看看今天拿到了多少颗水晶？{correct}颗！闪闪发光✨",
    ],
    "session_good": [
        "哇{name}今天表现真好！蘑菇屋又多了一些漂亮的东西~",
        "嘿嘿，今天真是美好的一天！{name}的水晶收藏又增加了~",
    ],
    "session_encourage": [
        "虽然今天有些题比较难，但{name}一直在努力！这就够啦！明天继续一起加油~",
    ],

    # ===== 告别场景 =====
    "goodbye": [
        "好啦！今天的冒险结束啦！{name}，明天再来找我玩哦~ 我会想你的！",
        "{name}要走了吗？好吧... 那你明天一定要来哦！嘟嘟在蘑菇屋等你！",
        "拜拜{name}！晚上要梦到嘟嘟哦！嘿嘿~ 明天见！",
        "今天的数学魔法都收好了吗？{name}再见！明天继续探险~",
    ],
}


def pick_template(scene: str, context: dict) -> str:
    """根据场景和上下文选择合适的模板"""
    templates = DIALOGUE_TEMPLATES.get(scene)
    if not templates:
        # fallback: use greeting
        templates = DIALOGUE_TEMPLATES["greeting_return"]

    return random.choice(templates)


def fill_template(template: str, context: dict) -> str:
    """用上下文填充模板变量"""
    result = template
    for key, value in context.items():
        if value is not None:
            result = result.replace("{" + key + "}", str(value))

    # 处理未填充的变量 — 移除或替换为通用词
    result = result.replace("{name}", "小朋友")
    result = result.replace("{zone}", "这里")
    result = result.replace("{topic}", "数学")
    result = result.replace("{total}", "几")
    result = result.replace("{correct}", "一些")
    result = result.replace("{streak}", "")

    return result


def generate_dialogue(
    scene: str,
    child_name: str = "",
    memory_events: Optional[list[dict]] = None,
    topic: Optional[str] = None,
    problem: Optional[str] = None,
    is_correct: Optional[bool] = None,
    streak: Optional[int] = None,
    total_problems: Optional[int] = None,
    correct_count: Optional[int] = None,
    zone: Optional[str] = None,
) -> dict:
    """
    生成嘟嘟的对话
    返回: {text: str, mood: str, animation: str}
    """
    context = {
        "name": child_name or "小朋友",
        "topic": topic or "",
        "problem": problem or "",
        "zone": zone or "",
        "total": total_problems or 0,
        "correct": correct_count or 0,
        "streak": streak or 0,
    }

    # 基础场景模板选择
    template = pick_template(scene, context)
    text = fill_template(template, context)

    # 根据场景确定嘟嘟的情绪和动画
    mood_map = {
        "greeting_first_time": ("curious", "wave"),
        "greeting_return": ("happy", "bounce"),
        "greeting_streak": ("excited", "sparkle"),
        "recall_yesterday": ("happy", "think"),
        "recall_struggle": ("determined", "think"),
        "recall_great_day": ("proud", "sparkle"),
        "explore_start": ("curious", "look_around"),
        "explore_discover": ("surprised", "point"),
        "problem_present": ("curious", "idle"),
        "correct_first_try": ("excited", "jump"),
        "correct_with_effort": ("happy", "clap"),
        "correct_streak_3": ("ecstatic", "sparkle"),
        "wrong_first_time": ("concerned", "gentle"),
        "wrong_second_time": ("worried", "think"),
        "wrong_final": ("comforting", "hug"),
        "recall_struggle_repeat": ("determined", "think"),
        "remember_last_time": ("proud", "think"),
        "dudu_learn_together": ("curious", "hop"),
        "wrong_teach_dudu": ("curious", "clap"),
        "correct_after_teach": ("proud", "sparkle"),
        "recall_progress": ("excited", "bounce"),
        "memory_encourage": ("warm", "hug"),
        "boss_start": ("brave", "power_up"),
        "boss_parent_turn": ("cheerful", "cheer"),
        "boss_child_turn": ("encouraging", "cheer"),
        "session_summary": ("happy", "idle"),
        "session_good": ("proud", "clap"),
        "session_encourage": ("warm", "gentle"),
        "goodbye": ("touched", "wave"),
    }

    mood, animation = mood_map.get(scene, ("happy", "idle"))

    # 随机添加前缀增加变化
    if random.random() < 0.3:
        prefix = random.choice(PREFIXES)
        if prefix and not text.startswith(prefix.strip()):
            text = prefix + text

    # 随机添加后缀
    if random.random() < 0.2:
        suffix = random.choice(SUFFIXES)
        if suffix and not text.endswith(suffix):
            text = text + suffix

    return {
        "text": text,
        "mood": mood,
        "animation": animation,
    }
