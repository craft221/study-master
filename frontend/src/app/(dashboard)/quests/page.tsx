'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import SparkSVG from '@/components/SparkSVG'
import {
  Target, Gift, Flame, Trophy, Star, Clock,
  CheckCircle2, Sparkles, Package, Crown, Zap,
  RefreshCw, ChevronRight
} from 'lucide-react'
import {
  getDailyQuests,
  claimQuestReward,
  claimDailyBonus,
  getQuestStreakStats,
  getMysteryChests,
  openMysteryChest,
  Quest,
  DailyQuestsResponse,
  StreakStats,
  MysteryChest,
  SparkMessage,
  getDifficultyColor,
  getDifficultyLabel,
  getChestRarityColor,
  getChestEmoji,
  getChestRarityLabel
} from '@/services/dailyQuests'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useSparkEventMessages } from '@/hooks/useSparkEvents'
import { useAuthStore } from '@/store/auth-store'
import { useLanguage } from '@/contexts/LanguageContext'

export default function DailyQuestsPage() {
  const { t } = useLanguage()
  const [questsData, setQuestsData] = useState<DailyQuestsResponse | null>(null)
  const [streakStats, setStreakStats] = useState<StreakStats | null>(null)
  const [chests, setChests] = useState<MysteryChest[]>([])
  const [loading, setLoading] = useState(true)
  const [claimingId, setClaimingId] = useState<number | null>(null)
  const [claimingBonus, setClaimingBonus] = useState(false)
  const [openingChest, setOpeningChest] = useState<number | null>(null)
  const [sparkMessage, setSparkMessage] = useState<SparkMessage | null>(null)
  const [showReward, setShowReward] = useState<{ xp: number; message: string } | null>(null)
  const [showChestReward, setShowChestReward] = useState<{
    rarity: string
    contents: Record<string, any>
  } | null>(null)

  // Hook Spark pour les messages du widget
  const { onQuestComplete, onDailyBonusClaimed } = useSparkEventMessages()

  // Pour mettre à jour l'XP dans le header
  const refreshUser = useAuthStore((state) => state.refreshUser)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [quests, stats, unopenedChests] = await Promise.all([
        getDailyQuests(),
        getQuestStreakStats(),
        getMysteryChests(true)
      ])
      setQuestsData(quests)
      setStreakStats(stats)
      setChests(unopenedChests)
      setSparkMessage(quests.spark_message)
    } catch (error) {
      console.error('Error fetching daily quests:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    })
  }

  const handleClaimReward = async (questId: number) => {
    try {
      setClaimingId(questId)
      const result = await claimQuestReward(questId)
      if (result.success) {
        triggerConfetti()
        setShowReward({ xp: result.xp_earned, message: result.spark_message.text })
        setSparkMessage(result.spark_message)
        setTimeout(() => setShowReward(null), 3000)

        // Message du widget Spark
        const quest = questsData?.quests.find(q => q.id === questId)
        const updatedData = await getDailyQuests()
        const isAllComplete = updatedData.stats?.all_completed || false
        onQuestComplete(quest?.title || 'Quête', isAllComplete)

        // Mettre à jour l'XP dans le header
        await refreshUser()

        await fetchData()
      }
    } catch (error) {
      console.error('Error claiming reward:', error)
    } finally {
      setClaimingId(null)
    }
  }

  const handleClaimBonus = async () => {
    try {
      setClaimingBonus(true)
      const result = await claimDailyBonus()
      if (result.success) {
        triggerConfetti()
        setShowReward({
          xp: result.bonus_xp,
          message: `${result.spark_message.text} + ${t('quests.chest')} ${t(`quests.chestRarity.${result.chest_rarity}`)}!`
        })
        setSparkMessage(result.spark_message)
        setTimeout(() => setShowReward(null), 4000)

        // Message du widget Spark
        onDailyBonusClaimed()

        // Mettre à jour l'XP dans le header
        await refreshUser()

        await fetchData()
      }
    } catch (error) {
      console.error('Error claiming bonus:', error)
    } finally {
      setClaimingBonus(false)
    }
  }

  const handleOpenChest = async (chestId: number) => {
    try {
      setOpeningChest(chestId)
      const result = await openMysteryChest(chestId)
      if (result.success) {
        triggerConfetti()
        setShowChestReward({ rarity: result.rarity, contents: result.contents })
        setSparkMessage(result.spark_message)
        setTimeout(() => setShowChestReward(null), 4000)

        // Mettre à jour l'XP dans le header
        await refreshUser()

        await fetchData()
      }
    } catch (error) {
      console.error('Error opening chest:', error)
    } finally {
      setOpeningChest(null)
    }
  }

  const getSparkMood = (): 'happy' | 'excited' | 'sad' | 'thinking' | 'encouraging' | 'sleeping' => {
    if (!sparkMessage) return 'happy'
    const mood = sparkMessage.mood
    if (['excited', 'proud'].includes(mood)) return 'excited'
    if (['sad', 'crying', 'desperate'].includes(mood)) return 'sad'
    if (['worried', 'dramatic'].includes(mood)) return 'thinking'
    if (['encouraging', 'relieved'].includes(mood)) return 'encouraging'
    return 'happy'
  }

  const getDifficultyBadgeVariant = (difficulty: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (difficulty) {
      case 'easy': return 'secondary'
      case 'medium': return 'default'
      case 'hard': return 'destructive'
      default: return 'outline'
    }
  }

  const getQuestIcon = (questType: string) => {
    const icons: Record<string, any> = {
      review_flashcards: '🎴',
      complete_quiz: '📝',
      study_minutes: '⏱️',
      earn_xp: '⚡',
      maintain_streak: '🔥',
      create_notes: '📓',
      create_flashcards: '🃏',
      win_duel: '⚔️',
      join_focus_room: '👥',
      perfect_quiz: '💯'
    }
    return icons[questType] || '🎯'
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    )
  }

  const quests = questsData?.quests || []
  const stats = questsData?.stats

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Reward Toast */}
      <AnimatePresence>
        {showReward && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
          >
            <Card className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg">
              <CardContent className="p-4 flex items-center gap-3">
                <Sparkles className="h-6 w-6" />
                <div>
                  <p className="font-bold">+{showReward.xp} XP</p>
                  <p className="text-sm opacity-90">{showReward.message}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chest Reward Toast */}
      <AnimatePresence>
        {showChestReward && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 flex items-center justify-center z-50 bg-black/50"
          >
            <Card className="bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-2xl max-w-sm">
              <CardContent className="p-6 text-center space-y-4">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="text-6xl"
                >
                  {getChestEmoji(showChestReward.rarity as any)}
                </motion.div>
                <h3 className="text-xl font-bold">{t('quests.chest')} {t(`quests.chestRarity.${showChestReward.rarity}`)}!</h3>
                <div className="space-y-2">
                  {showChestReward.contents.xp && (
                    <Badge variant="secondary" className="text-lg px-4 py-2">
                      <Zap className="h-4 w-4 mr-1" />
                      +{showChestReward.contents.xp} XP
                    </Badge>
                  )}
                  {showChestReward.contents.accessory && (
                    <Badge variant="outline" className="text-lg px-4 py-2 text-white border-white">
                      <Crown className="h-4 w-4 mr-1" />
                      {showChestReward.contents.accessory}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header with Spark */}
      <div className="flex flex-col md:flex-row items-center gap-6 bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-900/30 dark:to-yellow-900/30 rounded-2xl p-6">
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <SparkSVG mood={getSparkMood()} size={100} />
        </motion.div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-3xl font-bold mb-2 flex items-center justify-center md:justify-start gap-2">
            <Target className="h-8 w-8 text-orange-500" />
            {t('quests.title')}
          </h1>
          {sparkMessage && (
            <p className="text-lg text-muted-foreground italic">
              "{sparkMessage.text}"
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <Flame className="h-8 w-8 text-orange-500" />
            <span>{streakStats?.current_streak || 0}</span>
          </div>
          <span className="text-sm text-muted-foreground">{t('quests.daysStreak')}</span>
        </div>
      </div>

      {/* Progress Summary */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{t('quests.dailyProgress')}</span>
            <span className="text-sm text-muted-foreground">
              {stats?.total_claimed || 0}/3 {t('quests.completed')}
            </span>
          </div>
          <Progress
            value={((stats?.total_claimed || 0) / 3) * 100}
            className="h-3"
          />
          {stats?.all_completed && !stats?.bonus_claimed && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <Button
                onClick={handleClaimBonus}
                disabled={claimingBonus}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
              >
                {claimingBonus ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Gift className="h-4 w-4 mr-2" />
                )}
                {t('quests.claimBonus')}
              </Button>
            </motion.div>
          )}
          {stats?.bonus_claimed && (
            <div className="mt-4 text-center text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              {t('quests.bonusClaimed')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quest Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {quests.map((quest, index) => (
          <motion.div
            key={quest.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className={`relative overflow-hidden ${
              quest.status === 'claimed' ? 'opacity-75' : ''
            }`}>
              {/* Difficulty indicator */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${
                quest.difficulty === 'easy' ? 'bg-green-500' :
                quest.difficulty === 'medium' ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />

              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{quest.icon || getQuestIcon(quest.quest_type)}</span>
                    <div>
                      <CardTitle className="text-lg">{quest.title}</CardTitle>
                      <Badge variant={getDifficultyBadgeVariant(quest.difficulty)} className="mt-1">
                        {t(`quests.difficulty.${quest.difficulty}`)}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-300">
                    <Zap className="h-3 w-3 mr-1" />
                    {quest.xp_reward} XP
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {quest.description && (
                  <p className="text-sm text-muted-foreground">
                    {quest.description}
                  </p>
                )}

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{quest.current_value} / {quest.target_value}</span>
                    <span>{Math.round(quest.progress_percent)}%</span>
                  </div>
                  <Progress value={quest.progress_percent} className="h-2" />
                </div>

                {/* Action Button */}
                {quest.status === 'completed' && (
                  <Button
                    onClick={() => handleClaimReward(quest.id)}
                    disabled={claimingId === quest.id}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                  >
                    {claimingId === quest.id ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Gift className="h-4 w-4 mr-2" />
                    )}
                    {t('quests.claimReward')}
                  </Button>
                )}

                {quest.status === 'claimed' && (
                  <div className="flex items-center justify-center text-green-600 dark:text-green-400 gap-2">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>{t('quests.questComplete')}</span>
                  </div>
                )}

                {(quest.status === 'pending' || quest.status === 'in_progress') && (
                  <div className="text-center text-sm text-muted-foreground">
                    {t('quests.continueActivities')}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Mystery Chests Section */}
      {chests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-500" />
              {t('quests.mysteryChests')}
              <Badge variant="secondary">{chests.length}</Badge>
            </CardTitle>
            <CardDescription>
              {t('quests.chestsToOpen')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {chests.map((chest) => (
                <motion.div
                  key={chest.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Card
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      chest.rarity === 'legendary' ? 'ring-2 ring-yellow-400' :
                      chest.rarity === 'epic' ? 'ring-2 ring-purple-400' :
                      chest.rarity === 'rare' ? 'ring-2 ring-blue-400' : ''
                    }`}
                    onClick={() => handleOpenChest(chest.id)}
                  >
                    <CardContent className="p-4 text-center">
                      <motion.div
                        animate={{ y: [0, -3, 0] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="text-4xl mb-2"
                      >
                        {openingChest === chest.id ? (
                          <RefreshCw className="h-10 w-10 mx-auto animate-spin text-purple-500" />
                        ) : (
                          getChestEmoji(chest.rarity as any)
                        )}
                      </motion.div>
                      <Badge
                        variant={chest.rarity === 'legendary' ? 'default' : 'secondary'}
                        className={
                          chest.rarity === 'legendary' ? 'bg-yellow-500' :
                          chest.rarity === 'epic' ? 'bg-purple-500 text-white' :
                          chest.rarity === 'rare' ? 'bg-blue-500 text-white' : ''
                        }
                      >
                        {t(`quests.chestRarity.${chest.rarity}`)}
                      </Badge>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {t('quests.questStats')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
            <div className="text-center p-4 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <div className="text-3xl font-bold text-orange-600">{streakStats?.current_streak || 0}</div>
              <div className="text-sm text-muted-foreground">{t('quests.currentStreak')}</div>
            </div>
            <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
              <div className="text-3xl font-bold text-yellow-600">{streakStats?.longest_streak || 0}</div>
              <div className="text-sm text-muted-foreground">{t('quests.longestStreak')}</div>
            </div>
            <div className="text-center p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <div className="text-3xl font-bold text-green-600">{streakStats?.total_quests_completed || 0}</div>
              <div className="text-sm text-muted-foreground">{t('quests.questsCompleted')}</div>
            </div>
            <div className="text-center p-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <div className="text-3xl font-bold text-purple-600">{streakStats?.total_bonus_claimed || 0}</div>
              <div className="text-sm text-muted-foreground">{t('quests.bonusesClaimed')}</div>
            </div>
            <div className="text-center p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <div className="text-3xl font-bold text-blue-600">{streakStats?.total_xp_from_quests || 0}</div>
              <div className="text-sm text-muted-foreground">{t('quests.totalXP')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Streak Milestones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            {t('quests.streakBonuses')}
          </CardTitle>
          <CardDescription>
            {t('quests.streakBonusDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 justify-center">
            {[
              { days: 7, xp: 100, chest: 'rare' },
              { days: 14, xp: 200, chest: 'rare' },
              { days: 30, xp: 500, chest: 'epic' },
              { days: 60, xp: 1000, chest: 'epic' },
              { days: 100, xp: 2000, chest: 'legendary' }
            ].map((milestone) => {
              const isUnlocked = (streakStats?.current_streak || 0) >= milestone.days
              return (
                <div
                  key={milestone.days}
                  className={`text-center p-4 rounded-lg border-2 transition-all ${
                    isUnlocked
                      ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/30'
                      : 'border-gray-200 dark:border-gray-700 opacity-60'
                  }`}
                >
                  <div className="text-2xl mb-1">
                    {isUnlocked ? '🏆' : '🔒'}
                  </div>
                  <div className="font-bold">{milestone.days} {t('quests.days')}</div>
                  <div className="text-sm text-muted-foreground">
                    +{milestone.xp} XP
                  </div>
                  <div className="text-xs">
                    {getChestEmoji(milestone.chest as any)} {t(`quests.chestRarity.${milestone.chest}`)}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
