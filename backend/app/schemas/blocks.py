"""
Schemas pour l'éditeur par blocs (Notion-like)

Types de blocs supportés:
- paragraph: Texte simple
- heading_1/2/3: Titres H1, H2, H3
- bulleted_list: Liste à puces
- numbered_list: Liste numérotée
- toggle: Contenu pliable
- callout: Encadré avec icône
- quote: Citation
- code: Bloc de code
- math: Équation LaTeX (block mode)
- divider: Séparateur
- image: Image
- table: Tableau simple
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Union, Literal, Any
from enum import Enum


class BlockType(str, Enum):
    """Types de blocs disponibles"""
    PARAGRAPH = "paragraph"
    HEADING_1 = "heading_1"
    HEADING_2 = "heading_2"
    HEADING_3 = "heading_3"
    BULLETED_LIST = "bulleted_list"
    NUMBERED_LIST = "numbered_list"
    TOGGLE = "toggle"
    CALLOUT = "callout"
    QUOTE = "quote"
    CODE = "code"
    MATH = "math"
    DIVIDER = "divider"
    IMAGE = "image"
    TABLE = "table"


class TextStyle(BaseModel):
    """Style de texte inline"""
    bold: bool = False
    italic: bool = False
    underline: bool = False
    strikethrough: bool = False
    code: bool = False
    color: Optional[str] = None
    background_color: Optional[str] = None


class TextSpan(BaseModel):
    """Segment de texte avec style (rich text)"""
    text: str
    style: Optional[TextStyle] = None
    link: Optional[str] = None
    # Pour le LaTeX inline: $formula$
    math: Optional[str] = None


class RichText(BaseModel):
    """Texte riche composé de spans"""
    spans: List[TextSpan] = []

    @classmethod
    def from_plain(cls, text: str) -> "RichText":
        """Créer un RichText depuis du texte simple"""
        return cls(spans=[TextSpan(text=text)])

    def to_plain(self) -> str:
        """Convertir en texte brut"""
        return "".join(span.text for span in self.spans)


# ============== Block Definitions ==============

class BaseBlock(BaseModel):
    """Base pour tous les blocs"""
    id: str = Field(..., description="UUID unique du bloc")
    type: BlockType

    class Config:
        from_attributes = True


class ParagraphBlock(BaseBlock):
    """Bloc paragraphe"""
    type: Literal[BlockType.PARAGRAPH] = BlockType.PARAGRAPH
    content: str = ""  # Texte avec support markdown inline


class HeadingBlock(BaseBlock):
    """Bloc titre (H1, H2, H3)"""
    type: Literal[BlockType.HEADING_1, BlockType.HEADING_2, BlockType.HEADING_3]
    content: str = ""
    # Toggle heading (peut se plier)
    is_toggleable: bool = False
    children: List["Block"] = []


class BulletedListBlock(BaseBlock):
    """Bloc liste à puces"""
    type: Literal[BlockType.BULLETED_LIST] = BlockType.BULLETED_LIST
    content: str = ""
    children: List["Block"] = []  # Sous-listes


class NumberedListBlock(BaseBlock):
    """Bloc liste numérotée"""
    type: Literal[BlockType.NUMBERED_LIST] = BlockType.NUMBERED_LIST
    content: str = ""
    children: List["Block"] = []


class ToggleBlock(BaseBlock):
    """Bloc toggle (contenu pliable)"""
    type: Literal[BlockType.TOGGLE] = BlockType.TOGGLE
    content: str = ""  # Titre du toggle
    children: List["Block"] = []  # Contenu caché
    is_open: bool = False


class CalloutBlock(BaseBlock):
    """Bloc callout (encadré avec icône)"""
    type: Literal[BlockType.CALLOUT] = BlockType.CALLOUT
    content: str = ""
    icon: str = "💡"  # Emoji ou icon
    color: str = "yellow"  # yellow, blue, green, red, purple, gray


class QuoteBlock(BaseBlock):
    """Bloc citation"""
    type: Literal[BlockType.QUOTE] = BlockType.QUOTE
    content: str = ""


class CodeBlock(BaseBlock):
    """Bloc de code"""
    type: Literal[BlockType.CODE] = BlockType.CODE
    content: str = ""  # Code source
    language: str = "python"


class MathBlock(BaseBlock):
    """Bloc équation LaTeX (display mode)"""
    type: Literal[BlockType.MATH] = BlockType.MATH
    content: str = ""  # LaTeX sans les $$ (ajoutés automatiquement)


class DividerBlock(BaseBlock):
    """Bloc séparateur"""
    type: Literal[BlockType.DIVIDER] = BlockType.DIVIDER


class ImageBlock(BaseBlock):
    """Bloc image"""
    type: Literal[BlockType.IMAGE] = BlockType.IMAGE
    url: str = ""
    caption: str = ""
    width: Optional[int] = None
    height: Optional[int] = None
    alignment: str = "center"  # left, center, right


class TableCell(BaseModel):
    """Cellule de tableau"""
    content: str = ""


class TableBlock(BaseBlock):
    """Bloc tableau"""
    type: Literal[BlockType.TABLE] = BlockType.TABLE
    rows: List[List[str]] = []  # Matrice de cellules
    has_header: bool = True  # Première ligne = header


# Union de tous les types de blocs
Block = Union[
    ParagraphBlock,
    HeadingBlock,
    BulletedListBlock,
    NumberedListBlock,
    ToggleBlock,
    CalloutBlock,
    QuoteBlock,
    CodeBlock,
    MathBlock,
    DividerBlock,
    ImageBlock,
    TableBlock
]

# Pour les références circulaires
HeadingBlock.model_rebuild()
BulletedListBlock.model_rebuild()
NumberedListBlock.model_rebuild()
ToggleBlock.model_rebuild()


class BlockContent(BaseModel):
    """Structure de contenu d'une note en blocs"""
    version: int = 1  # Version du format pour migrations futures
    blocks: List[Block] = []

    def to_plain_text(self) -> str:
        """Convertir tous les blocs en texte brut (pour recherche)"""
        texts = []
        for block in self.blocks:
            if hasattr(block, 'content'):
                texts.append(block.content)
            if hasattr(block, 'children'):
                for child in block.children:
                    if hasattr(child, 'content'):
                        texts.append(child.content)
        return "\n".join(texts)

    def to_html(self) -> str:
        """Convertir en HTML pour affichage"""
        html_parts = []
        for block in self.blocks:
            html_parts.append(_block_to_html(block))
        return "\n".join(html_parts)

    def to_markdown(self) -> str:
        """Convertir en Markdown"""
        md_parts = []
        for block in self.blocks:
            md_parts.append(_block_to_markdown(block))
        return "\n\n".join(md_parts)


def _block_to_html(block: Block) -> str:
    """Convertir un bloc en HTML"""
    if isinstance(block, ParagraphBlock):
        return f"<p>{block.content}</p>"
    elif isinstance(block, HeadingBlock):
        level = block.type.value.split("_")[1]
        return f"<h{level}>{block.content}</h{level}>"
    elif isinstance(block, BulletedListBlock):
        children_html = "".join(f"<li>{_block_to_html(c)}</li>" for c in block.children) if block.children else ""
        return f"<ul><li>{block.content}{children_html}</li></ul>"
    elif isinstance(block, NumberedListBlock):
        children_html = "".join(f"<li>{_block_to_html(c)}</li>" for c in block.children) if block.children else ""
        return f"<ol><li>{block.content}{children_html}</li></ol>"
    elif isinstance(block, ToggleBlock):
        children_html = "".join(_block_to_html(c) for c in block.children)
        return f"<details><summary>{block.content}</summary>{children_html}</details>"
    elif isinstance(block, CalloutBlock):
        return f'<div class="callout callout-{block.color}"><span class="callout-icon">{block.icon}</span><div>{block.content}</div></div>'
    elif isinstance(block, QuoteBlock):
        return f"<blockquote>{block.content}</blockquote>"
    elif isinstance(block, CodeBlock):
        return f'<pre><code class="language-{block.language}">{block.content}</code></pre>'
    elif isinstance(block, MathBlock):
        return f'<div class="math-block">$${block.content}$$</div>'
    elif isinstance(block, DividerBlock):
        return "<hr />"
    elif isinstance(block, ImageBlock):
        style = f'text-align: {block.alignment};'
        img_style = ""
        if block.width:
            img_style += f"width: {block.width}px;"
        if block.height:
            img_style += f"height: {block.height}px;"
        caption = f'<figcaption>{block.caption}</figcaption>' if block.caption else ""
        return f'<figure style="{style}"><img src="{block.url}" alt="{block.caption}" style="{img_style}" />{caption}</figure>'
    elif isinstance(block, TableBlock):
        rows_html = []
        for i, row in enumerate(block.rows):
            tag = "th" if i == 0 and block.has_header else "td"
            cells = "".join(f"<{tag}>{cell}</{tag}>" for cell in row)
            rows_html.append(f"<tr>{cells}</tr>")
        return f'<table>{"".join(rows_html)}</table>'
    return ""


def _block_to_markdown(block: Block) -> str:
    """Convertir un bloc en Markdown"""
    if isinstance(block, ParagraphBlock):
        return block.content
    elif isinstance(block, HeadingBlock):
        level = int(block.type.value.split("_")[1])
        return f"{'#' * level} {block.content}"
    elif isinstance(block, BulletedListBlock):
        result = f"- {block.content}"
        for child in block.children:
            result += f"\n  {_block_to_markdown(child)}"
        return result
    elif isinstance(block, NumberedListBlock):
        result = f"1. {block.content}"
        for child in block.children:
            result += f"\n   {_block_to_markdown(child)}"
        return result
    elif isinstance(block, ToggleBlock):
        result = f"<details>\n<summary>{block.content}</summary>\n\n"
        for child in block.children:
            result += f"{_block_to_markdown(child)}\n"
        result += "</details>"
        return result
    elif isinstance(block, CalloutBlock):
        return f"> {block.icon} **Note:** {block.content}"
    elif isinstance(block, QuoteBlock):
        return f"> {block.content}"
    elif isinstance(block, CodeBlock):
        return f"```{block.language}\n{block.content}\n```"
    elif isinstance(block, MathBlock):
        return f"$$\n{block.content}\n$$"
    elif isinstance(block, DividerBlock):
        return "---"
    elif isinstance(block, ImageBlock):
        return f"![{block.caption}]({block.url})"
    elif isinstance(block, TableBlock):
        if not block.rows:
            return ""
        header = "| " + " | ".join(block.rows[0]) + " |"
        separator = "| " + " | ".join(["---"] * len(block.rows[0])) + " |"
        body = "\n".join("| " + " | ".join(row) + " |" for row in block.rows[1:])
        return f"{header}\n{separator}\n{body}"
    return ""


# ============== API Schemas ==============

class BlockCreate(BaseModel):
    """Création d'un bloc"""
    type: BlockType
    content: str = ""
    # Champs optionnels selon le type
    icon: Optional[str] = None
    color: Optional[str] = None
    language: Optional[str] = None
    url: Optional[str] = None
    caption: Optional[str] = None
    rows: Optional[List[List[str]]] = None
    children: Optional[List["BlockCreate"]] = None


class BlockUpdate(BaseModel):
    """Mise à jour d'un bloc"""
    content: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    language: Optional[str] = None
    is_open: Optional[bool] = None
    children: Optional[List[dict]] = None


class BlockMove(BaseModel):
    """Déplacement d'un bloc"""
    block_id: str
    new_index: int
    parent_id: Optional[str] = None  # Pour déplacer dans un toggle/heading


BlockCreate.model_rebuild()
