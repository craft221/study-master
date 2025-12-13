/**
 * Hook pour les quiz en temps réel
 */

import { useState, useEffect, useCallback } from 'react'
import { wsService } from '@/services/websocket'

interface QuizParticipant {
  user_id: number
  username: string
  score: number
  answers_count: number
}

interface QuizQuestion {
  index: number
  question: string
  options?: string[]
  time_limit: number
}

interface QuizState {
  isActive: boolean
  isHost: boolean
  currentQuestion: QuizQuestion | null
  participants: QuizParticipant[]
  leaderboard: QuizParticipant[]
  timeRemaining: number
  hasAnswered: boolean
  lastResults: any | null
}

export function useLiveQuiz(roomId: string | null, userId: number) {
  const [state, setState] = useState<QuizState>({
    isActive: false,
    isHost: false,
    currentQuestion: null,
    participants: [],
    leaderboard: [],
    timeRemaining: 0,
    hasAnswered: false,
    lastResults: null
  })

  useEffect(() => {
    if (!roomId) return

    wsService.joinRoom(roomId)

    // Quiz started
    const unsubStart = wsService.on('quiz_started', (data) => {
      setState(prev => ({
        ...prev,
        isActive: true,
        isHost: data.host_id === userId,
        participants: [],
        leaderboard: [],
        currentQuestion: null
      }))
    })

    // Next question
    const unsubQuestion = wsService.on('next_question', (data) => {
      setState(prev => ({
        ...prev,
        currentQuestion: {
          index: data.question_index,
          question: data.question,
          options: data.options,
          time_limit: data.time_limit
        },
        timeRemaining: data.time_limit,
        hasAnswered: false
      }))

      // Start countdown
      const interval = setInterval(() => {
        setState(prev => {
          if (prev.timeRemaining <= 1) {
            clearInterval(interval)
            return { ...prev, timeRemaining: 0 }
          }
          return { ...prev, timeRemaining: prev.timeRemaining - 1 }
        })
      }, 1000)

      return () => clearInterval(interval)
    })

    // Someone answered
    const unsubAnswer = wsService.on('answer_submitted', (data) => {
      setState(prev => ({
        ...prev,
        participants: prev.participants.map(p =>
          p.user_id === data.user_id
            ? { ...p, answers_count: p.answers_count + 1 }
            : p
        )
      }))
    })

    // Question results
    const unsubResults = wsService.on('question_results', (data) => {
      setState(prev => ({
        ...prev,
        lastResults: {
          correctAnswer: data.correct_answer,
          stats: data.stats
        },
        leaderboard: data.leaderboard || prev.leaderboard
      }))
    })

    // Quiz ended
    const unsubEnd = wsService.on('quiz_ended', (data) => {
      setState(prev => ({
        ...prev,
        isActive: false,
        currentQuestion: null,
        leaderboard: data.final_leaderboard || prev.leaderboard
      }))
    })

    // User joined quiz
    const unsubJoined = wsService.on('user_joined', (data) => {
      setState(prev => ({
        ...prev,
        participants: [
          ...prev.participants,
          {
            user_id: data.user_id,
            username: data.username,
            score: 0,
            answers_count: 0
          }
        ]
      }))
    })

    return () => {
      wsService.leaveRoom(roomId)
      unsubStart()
      unsubQuestion()
      unsubAnswer()
      unsubResults()
      unsubEnd()
      unsubJoined()
    }
  }, [roomId, userId])

  // Host actions
  const startQuiz = useCallback((quizId: number) => {
    if (!roomId) return
    wsService.send({
      type: 'quiz_live',
      data: { action: 'start_quiz', room_id: roomId, quiz_id: quizId }
    })
  }, [roomId])

  const nextQuestion = useCallback((question: any, timeLimit: number = 30) => {
    if (!roomId) return
    wsService.send({
      type: 'quiz_live',
      data: {
        action: 'next_question',
        room_id: roomId,
        question_index: state.currentQuestion ? state.currentQuestion.index + 1 : 0,
        question: question.question,
        options: question.options,
        time_limit: timeLimit
      }
    })
  }, [roomId, state.currentQuestion])

  const showResults = useCallback((correctAnswer: string, stats: any) => {
    if (!roomId) return
    wsService.send({
      type: 'quiz_live',
      data: {
        action: 'show_results',
        room_id: roomId,
        question_index: state.currentQuestion?.index || 0,
        correct_answer: correctAnswer,
        stats,
        leaderboard: state.leaderboard
      }
    })
  }, [roomId, state.currentQuestion, state.leaderboard])

  const endQuiz = useCallback(() => {
    if (!roomId) return
    wsService.send({
      type: 'quiz_live',
      data: {
        action: 'end_quiz',
        room_id: roomId,
        final_leaderboard: state.leaderboard
      }
    })
  }, [roomId, state.leaderboard])

  // Participant actions
  const submitAnswer = useCallback((answerIndex: number) => {
    if (!roomId || state.hasAnswered) return
    wsService.send({
      type: 'quiz_live',
      data: {
        action: 'submit_answer',
        room_id: roomId,
        question_index: state.currentQuestion?.index || 0,
        answer_index: answerIndex
      }
    })
    setState(prev => ({ ...prev, hasAnswered: true }))
  }, [roomId, state.hasAnswered, state.currentQuestion])

  return {
    ...state,
    // Host actions
    startQuiz,
    nextQuestion,
    showResults,
    endQuiz,
    // Participant actions
    submitAnswer
  }
}

export default useLiveQuiz
