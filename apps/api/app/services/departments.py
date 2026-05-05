from __future__ import annotations

from typing import Iterable, List, Tuple

from ..models import Option


DEPARTMENTS: List[Tuple[str, str]] = [
    ("all", "全部"),
    ("00001", "数学科学学院"),
    ("00004", "物理学院"),
    ("00010", "化学与分子工程学院"),
    ("00011", "生命科学学院"),
    ("00012", "地球与空间科学学院"),
    ("00013", "环境学院"),
    ("00016", "心理与认知科学学院"),
    ("00017", "软件与微电子学院"),
    ("00018", "新闻与传播学院"),
    ("00020", "中国语言文学系"),
    ("00021", "历史学系"),
    ("00022", "考古文博学院"),
    ("00023", "哲学系"),
    ("00024", "国际关系学院"),
    ("00025", "经济学院"),
    ("00028", "光华管理学院"),
    ("00029", "法学院"),
    ("00030", "信息管理系"),
    ("00031", "社会学系"),
    ("00032", "政府管理学院"),
    ("00038", "英语系"),
    ("00039", "外国语学院"),
    ("00040", "马克思主义学院"),
    ("00041", "体育教研部"),
    ("00042", "科学与社会研究中心"),
    ("00043", "艺术学院"),
    ("00044", "对外汉语教育学院"),
    ("00046", "元培学院"),
    ("00048", "信息科学技术学院"),
    ("00062", "国家发展研究院"),
    ("00067", "教育学院"),
    ("00068", "人口研究所"),
    ("00084", "前沿交叉学科研究院"),
    ("00086", "工学院"),
    ("00100", "集成电路学院"),
    ("00101", "计算机学院"),
    ("00106", "智能学院"),
    ("00107", "电子学院"),
    ("00126", "城市与环境学院"),
    ("00127", "环境科学与工程学院"),
    ("00182", "分子医学研究所"),
    ("00192", "歌剧研究院"),
    ("00195", "建筑与景观设计学院"),
    ("00208", "燕京学堂"),
    ("00232", "材料科学与工程学院"),
    ("00233", "未来技术学院"),
    ("10180", "医学部教学办"),
]

DEPARTMENT_NAME_BY_ID = dict(DEPARTMENTS)


def department_name(department_id: str) -> str:
    return DEPARTMENT_NAME_BY_ID.get(department_id, department_id)


def department_options(extra_ids: Iterable[str]) -> List[Option]:
    known_ids = set(DEPARTMENT_NAME_BY_ID)
    options = [Option(id=department_id, name=name) for department_id, name in DEPARTMENTS]
    options.extend(
        Option(id=department_id, name=department_id)
        for department_id in sorted(extra_ids)
        if department_id and department_id not in known_ids
    )
    return options
