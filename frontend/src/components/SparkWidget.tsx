"use client";

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { HelpCircle, Bell, Sun, X, Target, Flame, BookOpen } from 'lucide-react';
import Spark from './Spark';
import SparkHelpDialog from './SparkHelpDialog';
import SparkAnswerCard from './SparkAnswerCard';
import { useSpark } from '@/contexts/SparkContext';

/**
 * SparkWidget - Widget prêt à l'emploi pour afficher Spark
 *
 * Gère automatiquement l'état et les messages via le hook useSpark
 * Inclut un bouton pour demander de l'aide
 * Affiche les notifications et le briefing quotidien de manière proactive
 */

interface SparkWidgetProps {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center';
  autoShow?: boolean; // Affiche automatiquement des messages
  showHelpButton?: boolean; // Affiche le bouton "Demander de l'aide"
  className?: string;
}

const SparkWidget: React.FC<SparkWidgetProps> = ({
  position = 'bottom-right',
  autoShow = true,
  showHelpButton = true,
  className = '',
}) => {
  const {
    sparkState,
    currentMessage,
    currentAnswer,
    isLoading,
    briefing,
    notifications,
    unreadNotificationCount,
    interactWithSpark,
    askQuestion,
    clearAnswer,
    fetchBriefing,
    markNotificationsRead,
    dismissNotification,
  } = useSpark();

  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isBriefingOpen, setIsBriefingOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Attendre le montage côté client pour éviter les erreurs d'hydratation
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Afficher automatiquement le briefing la première fois de la session
  useEffect(() => {
    console.log('🐿️ Widget: Check briefing auto-show', { isMounted, hasBriefing: !!briefing });

    if (!isMounted || !briefing) {
      console.log('🐿️ Widget: Skip - not mounted or no briefing');
      return;
    }

    const briefingShownThisSession = sessionStorage.getItem('spark_briefing_shown_session');
    console.log('🐿️ Widget: briefingShownThisSession =', briefingShownThisSession);

    if (!briefingShownThisSession) {
      console.log('🐿️ Widget: Programmation affichage briefing dans 5s...');
      // Afficher le briefing après un délai pour ne pas interférer avec le message de bienvenue
      const timer = setTimeout(() => {
        console.log('🐿️ Widget: AFFICHAGE BRIEFING!');
        setIsBriefingOpen(true);
        sessionStorage.setItem('spark_briefing_shown_session', 'true');
      }, 5000); // 5 secondes après le chargement

      return () => clearTimeout(timer);
    }
  }, [isMounted, briefing]);

  // Afficher les notifications importantes automatiquement
  useEffect(() => {
    if (!isMounted || notifications.length === 0) return;

    // Chercher les notifications urgentes non lues
    const urgentNotifications = notifications.filter(
      (n: any) => !n.isRead && (
        n.notificationType === 'streak_warning' ||
        n.notificationType === 'exam_reminder'
      )
    );

    if (urgentNotifications.length > 0) {
      // Afficher après le briefing potentiel
      const timer = setTimeout(() => {
        if (!isBriefingOpen) {
          setIsNotificationsOpen(true);
        }
      }, 12000); // 12 secondes

      return () => clearTimeout(timer);
    }
  }, [isMounted, notifications, isBriefingOpen]);

  // Debug logs (seulement côté client)
  if (isMounted) {
    console.log('[SparkWidget] Render - currentMessage:', currentMessage);
    console.log('[SparkWidget] Render - sparkState:', sparkState);
  }

  // Valeurs par défaut si pas de données
  const defaultSparkState = {
    level: 1,
    currentAccessory: null,
  };

  // Ne pas rendre pendant le SSR pour éviter les erreurs d'hydratation
  if (!isMounted) {
    return null;
  }

  const handleAskQuestion = async (question: string) => {
    await askQuestion(question);
    setIsHelpDialogOpen(false);
  };

  const handleSparkClick = () => {
    // Si une réponse est affichée, la fermer
    if (currentAnswer) {
      clearAnswer();
    }
    // Interaction normale avec Spark (messages aléatoires)
    interactWithSpark();
  };

  return (
    <>
      {/* Spark lui-même */}
      <Spark
        mood={currentMessage?.mood || 'happy'}
        animation={currentMessage?.animation || 'idle'}
        message={currentMessage?.message}
        level={sparkState?.level || defaultSparkState.level}
        accessory={sparkState?.currentAccessory || defaultSparkState.currentAccessory}
        onClick={handleSparkClick}
        position={position}
        showMessage={!!currentMessage}
        className={className}
      />

      {/* Bouton d'aide flottant */}
      {showHelpButton && !isHelpDialogOpen && !currentAnswer && (
        <button
          onClick={() => setIsHelpDialogOpen(true)}
          className="fixed bottom-44 right-8 bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3 rounded-full shadow-lg hover:shadow-xl hover:scale-110 transition-all z-[60] group"
          aria-label="Demander de l'aide à Spark"
          title="Pose une question à Spark !"
        >
          <HelpCircle className="w-6 h-6" />
          <span className="absolute -top-10 right-0 bg-black/75 text-white text-xs px-3 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Pose une question à Spark ! 💡
          </span>
        </button>
      )}

      {/* Dialogue pour poser des questions */}
      <SparkHelpDialog
        isOpen={isHelpDialogOpen}
        onClose={() => setIsHelpDialogOpen(false)}
        onAskQuestion={handleAskQuestion}
        isLoading={isLoading}
      />

      {/* Carte de réponse */}
      <AnimatePresence>
        {currentAnswer && (
          <SparkAnswerCard
            answer={currentAnswer.answer}
            suggestions={currentAnswer.suggestions}
            onClose={clearAnswer}
            onSuggestionClick={(suggestion) => {
              console.log('Suggestion cliquée:', suggestion);
            }}
          />
        )}
      </AnimatePresence>

      {/* Panneau Briefing quotidien */}
      <AnimatePresence>
        {isBriefingOpen && briefing && (
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-4 bottom-48 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-[70]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="w-6 h-6" />
                  <h3 className="font-bold text-lg">Briefing du jour</h3>
                </div>
                <button
                  onClick={() => setIsBriefingOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm mt-2 text-amber-100">{briefing.greeting}</p>
            </div>

            {/* Content */}
            <div className="p-4 max-h-80 overflow-y-auto space-y-4">
              {/* Streak Status */}
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-xl">
                <Flame className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="font-semibold text-gray-900">
                    Streak: {briefing.streakStatus?.current || 0} jours
                  </p>
                  <p className="text-sm text-gray-600">
                    {briefing.streakStatus?.message || "Continue comme ça !"}
                  </p>
                </div>
              </div>

              {/* Today Goals */}
              {briefing.todayGoals && briefing.todayGoals.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary-600" />
                    Objectifs du jour
                  </h4>
                  <div className="space-y-2">
                    {briefing.todayGoals.slice(0, 3).map((goal: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded-lg"
                      >
                        <span className="text-lg">🎯</span>
                        <span className="text-gray-700">{goal.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Reviews */}
              {briefing.pendingReviews && briefing.pendingReviews.count > 0 && (
                <div className="p-3 bg-blue-50 rounded-xl">
                  <h4 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                    Révisions en attente
                  </h4>
                  <p className="text-sm text-gray-600">
                    {briefing.pendingReviews.message || `${briefing.pendingReviews.count} éléments à réviser`}
                  </p>
                </div>
              )}

              {/* Motivation Quote */}
              {briefing.motivationQuote && (
                <div className="p-3 bg-purple-50 rounded-xl border-l-4 border-purple-500">
                  <p className="text-sm text-gray-700 italic">"{briefing.motivationQuote}"</p>
                </div>
              )}

              {/* Fun Fact */}
              {briefing.funFact && (
                <div className="p-3 bg-green-50 rounded-xl">
                  <p className="text-xs text-green-800">💡 {briefing.funFact}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-gray-50 border-t">
              <button
                onClick={() => setIsBriefingOpen(false)}
                className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:opacity-90 transition"
              >
                C'est parti ! 🚀
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panneau Notifications */}
      <AnimatePresence>
        {isNotificationsOpen && (
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-4 bottom-48 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-[70]"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="w-6 h-6" />
                  <h3 className="font-bold text-lg">Notifications</h3>
                  {unreadNotificationCount > 0 && (
                    <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                      {unreadNotificationCount} nouvelles
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsNotificationsOpen(false)}
                  className="p-1 hover:bg-white/20 rounded-full transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Aucune notification</p>
                  <p className="text-xs mt-1">Spark te préviendra si besoin !</p>
                </div>
              ) : (
                <div className="divide-y">
                  {notifications.map((notification: any) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition ${
                        !notification.isRead ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${
                          notification.notification_type === 'streak_warning' ? 'bg-orange-100' :
                          notification.notification_type === 'milestone' ? 'bg-green-100' :
                          notification.notification_type === 'exam_reminder' ? 'bg-red-100' :
                          'bg-blue-100'
                        }`}>
                          {notification.notification_type === 'streak_warning' ? (
                            <Flame className="w-4 h-4 text-orange-600" />
                          ) : notification.notification_type === 'exam_reminder' ? (
                            <Target className="w-4 h-4 text-red-600" />
                          ) : (
                            <Bell className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{notification.title}</p>
                          <p className="text-xs text-gray-600 mt-1">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(notification.created_at).toLocaleString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <button
                          onClick={() => dismissNotification(notification.id)}
                          className="p-1 hover:bg-gray-200 rounded-full transition text-gray-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && unreadNotificationCount > 0 && (
              <div className="p-3 bg-gray-50 border-t">
                <button
                  onClick={() => {
                    const unreadIds = notifications.filter((n: any) => !n.isRead).map((n: any) => n.id);
                    markNotificationsRead(unreadIds);
                  }}
                  className="w-full py-2 text-blue-600 text-sm font-medium hover:bg-blue-50 rounded-lg transition"
                >
                  Tout marquer comme lu
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SparkWidget;
