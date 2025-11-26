"""
Modèle Schedule (Emploi du temps)
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Time
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    location = Column(String, nullable=True)
    is_recurring = Column(Boolean, default=True)
    color = Column(String, default="#3B82F6")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    user = relationship("User")
    subject = relationship("Subject")
