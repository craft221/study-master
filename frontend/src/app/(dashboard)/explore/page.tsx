"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  BookOpen,
  Brain,
  FileQuestion,
  TrendingUp,
  Users,
  Clock,
  Star,
  ChevronDown,
  X,
  Play,
  Copy,
  ExternalLink,
  Sparkles,
  Eye,
  Flag,
  Languages,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { useRouter } from "next/navigation";

// Types
interface Author {
  id: number;
  username: string;
  avatar_url?: string;
}

interface Subject {
  id: number;
  name: string;
  color?: string;
}

interface PublicNote {
  id: number;
  type: string;
  title: string;
  content_preview: string;
  subject?: Subject;
  author?: Author;
  tags: string[];
  language: string;
  created_at?: string;
}

interface PublicFlashcardDeck {
  id?: number;
  type: string;
  deck_name: string;
  card_count: number;
  subject?: Subject;
  author: Author;
  language: string;
  created_at?: string;
}

interface PublicQuiz {
  id: number;
  type: string;
  title: string;
  description?: string;
  question_count: number;
  difficulty: string;
  time_limit_minutes?: number;
  total_plays: number;
  average_score: number;
  share_code?: string;
  subject?: Subject;
  author?: Author;
  is_ai_generated: boolean;
  language: string;
  created_at?: string;
}

interface PopularSubject {
  id: number;
  name: string;
  color?: string;
  content_count: number;
}

interface SearchResults {
  notes: PublicNote[];
  flashcards: PublicFlashcardDeck[];
  quizzes: PublicQuiz[];
  total_count: number;
  page: number;
  limit: number;
  has_more: boolean;
}

type ContentType = "all" | "notes" | "flashcards" | "quizzes";
type SortBy = "recent" | "popular" | "rating";
type LanguageFilter = "all" | "fr" | "en" | "es";

const languageConfig: Record<LanguageFilter, { label: string; flag: string }> = {
  all: { label: "Toutes", flag: "🌍" },
  fr: { label: "Français", flag: "🇫🇷" },
  en: { label: "English", flag: "🇬🇧" },
  es: { label: "Español", flag: "🇪🇸" },
};

const contentTypeConfig = {
  all: { label: "Tout", icon: Sparkles },
  notes: { label: "Notes", icon: BookOpen },
  flashcards: { label: "Flashcards", icon: Brain },
  quizzes: { label: "Quiz", icon: FileQuestion },
};

const sortConfig = {
  recent: { label: "Plus récents", icon: Clock },
  popular: { label: "Populaires", icon: TrendingUp },
  rating: { label: "Meilleurs scores", icon: Star },
};

const difficultyColors: Record<string, string> = {
  easy: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  hard: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function ExplorePage() {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [contentType, setContentType] = useState<ContentType>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageFilter>("all");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [popularSubjects, setPopularSubjects] = useState<PopularSubject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Detect user language on mount and fetch subjects
  useEffect(() => {
    fetchPopularSubjects();
    // Détecter la langue du navigateur
    const browserLang = navigator.language.split("-")[0];
    if (browserLang === "fr" || browserLang === "en" || browserLang === "es") {
      setSelectedLanguage(browserLang as LanguageFilter);
    }
  }, []);

  // Search when filters change
  useEffect(() => {
    const debounce = setTimeout(() => {
      searchContent();
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, contentType, sortBy, selectedSubject, selectedLanguage, page]);

  const fetchPopularSubjects = async () => {
    try {
      const response = await api.get("/explore/subjects/popular?limit=10");
      setPopularSubjects(response.data.subjects || []);
    } catch (error) {
      console.error("Error fetching popular subjects:", error);
    }
  };

  const searchContent = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("content_type", contentType);
      params.append("sort_by", sortBy);
      params.append("page", page.toString());
      params.append("limit", "20");
      params.append("language", selectedLanguage);

      if (searchQuery) {
        params.append("q", searchQuery);
      }
      if (selectedSubject) {
        params.append("subject_id", selectedSubject.toString());
      }

      const response = await api.get(`/explore/search?${params.toString()}`);
      setResults(response.data);
    } catch (error) {
      console.error("Error searching content:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le contenu",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyShareCode = (code: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/play/${code}`);
    toast({
      title: "Lien copié !",
      description: "Le lien du quiz a été copié dans le presse-papier",
    });
  };

  const duplicateContent = async (type: string, id: number, deckName?: string, deckOwnerId?: number, deckSubjectId?: number) => {
    const key = `${type}-${id}`;
    setDuplicatingId(key);
    try {
      const payload: any = {
        content_type: type,
        content_id: id,
      };
      if (deckName) {
        payload.deck_name = deckName;
        payload.deck_owner_id = deckOwnerId;
        payload.deck_subject_id = deckSubjectId;
      }
      const response = await api.post("/explore/duplicate", payload);
      toast({
        title: "Dupliqué !",
        description: response.data.message,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.response?.data?.detail || "Impossible de dupliquer",
        variant: "destructive",
      });
    } finally {
      setDuplicatingId(null);
    }
  };

  const reportContent = async (type: string, id: number, reason: string = "inappropriate") => {
    try {
      await api.post("/explore/report", {
        content_type: type,
        content_id: id,
        reason: reason,
      });
      toast({
        title: "Signalement envoyé",
        description: "Notre équipe va examiner ce contenu",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.response?.data?.detail || "Impossible de signaler",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedSubject(null);
    setContentType("all");
    setSortBy("recent");
    setSelectedLanguage("all");
    setPage(1);
  };

  const hasActiveFilters = searchQuery || selectedSubject || contentType !== "all" || sortBy !== "recent" || selectedLanguage !== "all";

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-purple-500" />
          Explorer
        </h1>
        <p className="text-muted-foreground mt-2">
          Découvre du contenu créé par la communauté Studera
        </p>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4 mb-8">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Rechercher des notes, flashcards, quiz..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-10 h-12 text-lg"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => setSearchQuery("")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Content Type Tabs */}
          <Tabs
            value={contentType}
            onValueChange={(v) => {
              setContentType(v as ContentType);
              setPage(1);
            }}
          >
            <TabsList>
              {Object.entries(contentTypeConfig).map(([key, config]) => (
                <TabsTrigger key={key} value={key} className="gap-2">
                  <config.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{config.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                {sortConfig[sortBy].icon && (
                  <span className="w-4 h-4">
                    {(() => {
                      const Icon = sortConfig[sortBy].icon;
                      return <Icon className="w-4 h-4" />;
                    })()}
                  </span>
                )}
                {sortConfig[sortBy].label}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.entries(sortConfig).map(([key, config]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => {
                    setSortBy(key as SortBy);
                    setPage(1);
                  }}
                >
                  <config.icon className="w-4 h-4 mr-2" />
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Subject Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                {selectedSubject
                  ? popularSubjects.find((s) => s.id === selectedSubject)?.name || "Matière"
                  : "Toutes les matières"}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-64 overflow-y-auto">
              <DropdownMenuItem onClick={() => setSelectedSubject(null)}>
                Toutes les matières
              </DropdownMenuItem>
              {popularSubjects.map((subject) => (
                <DropdownMenuItem
                  key={subject.id}
                  onClick={() => {
                    setSelectedSubject(subject.id);
                    setPage(1);
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: subject.color || "#6366f1" }}
                  />
                  {subject.name}
                  <Badge variant="secondary" className="ml-auto">
                    {subject.content_count}
                  </Badge>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Language Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Languages className="w-4 h-4" />
                {languageConfig[selectedLanguage].flag} {languageConfig[selectedLanguage].label}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {Object.entries(languageConfig).map(([key, config]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => {
                    setSelectedLanguage(key as LanguageFilter);
                    setPage(1);
                  }}
                >
                  <span className="mr-2">{config.flag}</span>
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" />
              Effacer les filtres
            </Button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-4" />
                  <div className="h-3 bg-muted rounded w-full mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : results ? (
          <>
            {/* Stats */}
            <div className="text-sm text-muted-foreground">
              {results.total_count} résultat{results.total_count !== 1 ? "s" : ""} trouvé
              {results.total_count !== 1 ? "s" : ""}
            </div>

            {/* Notes */}
            {(contentType === "all" || contentType === "notes") && results.notes.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  Notes
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.notes.map((note) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card className="h-full hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-lg line-clamp-2">{note.title}</CardTitle>
                            {note.subject && (
                              <Badge
                                variant="secondary"
                                style={{ backgroundColor: note.subject.color || undefined }}
                              >
                                {note.subject.name}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                            {note.content_preview}
                          </p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {note.author?.username || "Anonyme"}
                            </span>
                            <span>{formatDate(note.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/explore/notes/${note.id}`)}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Voir
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => duplicateContent("notes", note.id)}
                              disabled={duplicatingId === `notes-${note.id}`}
                            >
                              {duplicatingId === `notes-${note.id}` ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Copy className="w-4 h-4 mr-1" />
                              )}
                              Dupliquer
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-orange-500 hover:text-orange-600"
                              onClick={() => reportContent("notes", note.id)}
                            >
                              <Flag className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Flashcard Decks */}
            {(contentType === "all" || contentType === "flashcards") &&
              results.flashcards.length > 0 && (
                <section>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-500" />
                    Decks de Flashcards
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {results.flashcards.map((deck, index) => (
                      <motion.div
                        key={`${deck.deck_name}-${index}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="h-full hover:shadow-lg transition-shadow">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <CardTitle className="text-lg">{deck.deck_name}</CardTitle>
                              {deck.subject && (
                                <Badge
                                  variant="secondary"
                                  style={{ backgroundColor: deck.subject.color || undefined }}
                                >
                                  {deck.subject.name}
                                </Badge>
                              )}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2 mb-4">
                              <Badge variant="outline">
                                {deck.card_count} carte{deck.card_count !== 1 ? "s" : ""}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {deck.author.username}
                              </span>
                              <span>{formatDate(deck.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => duplicateContent(
                                  "flashcards",
                                  deck.id || 0,
                                  deck.deck_name,
                                  deck.author.id,
                                  deck.subject?.id
                                )}
                                disabled={duplicatingId === `flashcards-${deck.id || 0}`}
                              >
                                {duplicatingId === `flashcards-${deck.id || 0}` ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <Copy className="w-4 h-4 mr-1" />
                                )}
                                Dupliquer
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-orange-500 hover:text-orange-600"
                                onClick={() => reportContent("flashcards", deck.id || 0)}
                              >
                                <Flag className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </section>
              )}

            {/* Quizzes */}
            {(contentType === "all" || contentType === "quizzes") && results.quizzes.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileQuestion className="w-5 h-5 text-green-500" />
                  Quiz
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.quizzes.map((quiz) => (
                    <motion.div
                      key={quiz.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card className="h-full hover:shadow-lg transition-shadow">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-lg line-clamp-2">{quiz.title}</CardTitle>
                            <Badge className={difficultyColors[quiz.difficulty] || ""}>
                              {quiz.difficulty === "easy"
                                ? "Facile"
                                : quiz.difficulty === "hard"
                                ? "Difficile"
                                : "Moyen"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {quiz.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {quiz.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-2 mb-4">
                            <Badge variant="outline">
                              {quiz.question_count} question{quiz.question_count !== 1 ? "s" : ""}
                            </Badge>
                            {quiz.time_limit_minutes && (
                              <Badge variant="outline">
                                <Clock className="w-3 h-3 mr-1" />
                                {quiz.time_limit_minutes} min
                              </Badge>
                            )}
                            {quiz.is_ai_generated && (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                                <Sparkles className="w-3 h-3 mr-1" />
                                IA
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm mb-4">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Play className="w-4 h-4" />
                              {quiz.total_plays} partie{quiz.total_plays !== 1 ? "s" : ""}
                            </span>
                            {quiz.average_score > 0 && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Star className="w-4 h-4 text-yellow-500" />
                                {quiz.average_score}%
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {quiz.author?.username || "Anonyme"}
                            </span>
                            <div className="flex gap-2">
                              {quiz.share_code && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copyShareCode(quiz.share_code!)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                onClick={() =>
                                  router.push(
                                    quiz.share_code
                                      ? `/play/${quiz.share_code}`
                                      : `/quizzes/${quiz.id}`
                                  )
                                }
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Jouer
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => duplicateContent("quizzes", quiz.id)}
                              disabled={duplicatingId === `quizzes-${quiz.id}`}
                            >
                              {duplicatingId === `quizzes-${quiz.id}` ? (
                                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                              ) : (
                                <Copy className="w-4 h-4 mr-1" />
                              )}
                              Dupliquer
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-orange-500 hover:text-orange-600"
                              onClick={() => reportContent("quizzes", quiz.id)}
                            >
                              <Flag className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {results.notes.length === 0 &&
              results.flashcards.length === 0 &&
              results.quizzes.length === 0 && (
                <div className="text-center py-12">
                  <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Aucun contenu trouvé</h3>
                  <p className="text-muted-foreground mb-4">
                    Essaie d'ajuster tes filtres ou ta recherche
                  </p>
                  <Button onClick={clearFilters}>Effacer les filtres</Button>
                </div>
              )}

            {/* Load More */}
            {results.has_more && (
              <div className="text-center pt-4">
                <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={isLoading}>
                  Charger plus
                </Button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
