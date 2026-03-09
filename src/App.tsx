import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { 
  Plus, 
  Trash2, 
  FileText, 
  Download, 
  GripVertical, 
  Image as ImageIcon, 
  ChevronRight, 
  ChevronLeft,
  LogOut,
  PlusCircle,
  Save,
  Loader2,
  AlertTriangle,
  RefreshCcw
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { db, auth, storage, handleFirestoreError, OperationType } from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Types ---
interface Paper {
  id: string;
  title: string;
  subject: string;
  createdAt: any;
  creatorUid: string;
}

interface Section {
  id: string;
  title: string;
  marks: number;
  questionCount: number;
  order: number;
}

interface Question {
  id: string;
  text: string;
  category: string;
  marks: number;
  imageUrl?: string;
  sectionId: string;
  order: number;
}

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.toString();
      let errorDetails = null;

      try {
        if (this.state.error?.message) {
          const parsed = JSON.parse(this.state.error.message);
          if (parsed.error && parsed.operationType) {
            errorMessage = `Firestore ${parsed.operationType} error: ${parsed.error}`;
            errorDetails = parsed;
          }
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6">
            <AlertTriangle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-600 mb-8 max-w-md">
            {errorMessage || "The application encountered an unexpected error. Please try refreshing the page."}
          </p>
          {errorDetails && (
            <div className="bg-white p-4 rounded-lg border border-slate-200 mb-8 text-left w-full max-w-lg overflow-auto max-h-40">
              <div className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Error Context</div>
              <pre className="text-[10px] text-red-500 font-mono">
                {JSON.stringify(errorDetails, null, 2)}
              </pre>
            </div>
          )}
          {!errorDetails && this.state.error && (
            <div className="bg-white p-4 rounded-lg border border-slate-200 mb-8 text-left w-full max-w-lg overflow-auto max-h-40">
              <code className="text-xs text-red-500 font-mono">
                {this.state.error.toString()}
              </code>
            </div>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="bg-indigo-600 text-white py-2 px-6 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <RefreshCcw size={18} />
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

const SortableQuestion = ({ question, onEdit, onDelete }: { 
  question: Question, 
  onEdit: (q: Question) => void, 
  onDelete: (id: string) => void,
  key?: React.Key
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="bg-white border border-slate-200 rounded-lg p-4 mb-3 flex items-start gap-3 group shadow-sm hover:shadow-md transition-shadow"
    >
      <button {...attributes} {...listeners} className="mt-1 text-slate-400 cursor-grab active:cursor-grabbing">
        <GripVertical size={18} />
      </button>
      <div className="flex-1">
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            {question.category} • {question.marks} Marks
          </span>
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(question)} className="text-slate-400 hover:text-indigo-600 transition-colors">
              <Plus size={16} />
            </button>
            <button onClick={() => onDelete(question.id)} className="text-slate-400 hover:text-red-600 transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <p className="text-slate-800 whitespace-pre-wrap">{question.text}</p>
        {question.imageUrl && (
          <img 
            src={question.imageUrl} 
            alt="Question diagram" 
            className="mt-3 max-h-48 rounded border border-slate-200 object-contain"
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [activePaper, setActivePaper] = useState<Paper | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isCreatingPaper, setIsCreatingPaper] = useState(false);
  const [newPaperTitle, setNewPaperTitle] = useState('');
  const [newPaperSubject, setNewPaperSubject] = useState('');
  
  const [editingSection, setEditingSection] = useState<Partial<Section> | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Partial<Question> | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [exporting, setExporting] = useState(false);
  const paperRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setIsAuthReady(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthReady) return;
    const q = query(
      collection(db, 'papers'), 
      where('creatorUid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPapers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Paper)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'papers');
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activePaper || !isAuthReady) return;
    
    const sectionsUnsubscribe = onSnapshot(
      query(collection(db, `papers/${activePaper.id}/sections`), orderBy('order', 'asc')),
      (snapshot) => {
        setSections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Section)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `papers/${activePaper.id}/sections`);
      }
    );

    const questionsUnsubscribe = onSnapshot(
      query(collection(db, `papers/${activePaper.id}/questions`), orderBy('order', 'asc')),
      (snapshot) => {
        setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `papers/${activePaper.id}/questions`);
      }
    );

    return () => {
      sectionsUnsubscribe();
      questionsUnsubscribe();
    };
  }, [activePaper]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setLoginLoading(true);
    setLoginError(null);
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      let message = "Login failed. Please try again.";
      if (error.code === 'auth/popup-blocked') {
        message = "The login popup was blocked by your browser. Please allow popups for this site.";
      } else if (error.code === 'auth/unauthorized-domain') {
        message = "This domain is not authorized for login. Please check your Firebase Console settings.";
      } else if (error.message) {
        message = error.message;
      }
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => signOut(auth);

  const loadSampleData = async () => {
    if (!user || !isAuthReady) return;
    setLoading(true);
    try {
      const paperRef = await addDoc(collection(db, 'papers'), {
        title: 'Sample Physics Exam',
        subject: 'Physics',
        creatorUid: user.uid,
        createdAt: serverTimestamp()
      });

      const sectionARef = await addDoc(collection(db, `papers/${paperRef.id}/sections`), {
        title: 'Section A (Objective)',
        marks: 10,
        questionCount: 5,
        order: 0
      });

      const sectionBRef = await addDoc(collection(db, `papers/${paperRef.id}/sections`), {
        title: 'Section B (Descriptive)',
        marks: 20,
        questionCount: 2,
        order: 1
      });

      const sampleQuestions = [
        {
          text: 'What is the SI unit of force?',
          category: 'MCQ',
          marks: 2,
          sectionId: sectionARef.id,
          order: 0
        },
        {
          text: 'Which of the following is a vector quantity?',
          category: 'MCQ',
          marks: 2,
          sectionId: sectionARef.id,
          order: 1
        },
        {
          text: 'State Newton\'s Second Law of Motion.',
          category: 'Short Answer',
          marks: 5,
          sectionId: sectionBRef.id,
          order: 0
        },
        {
          text: 'Explain the principle of conservation of energy with an example.',
          category: 'Long Answer',
          marks: 10,
          sectionId: sectionBRef.id,
          order: 1
        }
      ];

      for (const q of sampleQuestions) {
        await addDoc(collection(db, `papers/${paperRef.id}/questions`), q);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'papers/sample');
    } finally {
      setLoading(false);
    }
  };

  const createPaper = async () => {
    if (!user || !newPaperTitle || !isAuthReady) return;
    try {
      const docRef = await addDoc(collection(db, 'papers'), {
        title: newPaperTitle,
        subject: newPaperSubject,
        creatorUid: user.uid,
        createdAt: serverTimestamp()
      });
      setNewPaperTitle('');
      setNewPaperSubject('');
      setIsCreatingPaper(false);
      // Auto-create a default section
      await addDoc(collection(db, `papers/${docRef.id}/sections`), {
        title: 'Section A',
        marks: 20,
        order: 0
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'papers');
    }
  };

  const addSection = async () => {
    if (!activePaper || !isAuthReady) return;
    try {
      await addDoc(collection(db, `papers/${activePaper.id}/sections`), {
        title: `Section ${String.fromCharCode(65 + sections.length)}`,
        marks: 20,
        questionCount: 5,
        order: sections.length
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `papers/${activePaper.id}/sections`);
    }
  };

  const deleteSection = async (sectionId: string) => {
    if (!activePaper || !isAuthReady) return;
    try {
      await deleteDoc(doc(db, `papers/${activePaper.id}/sections`, sectionId));
      const sectionQuestions = questions.filter(q => q.sectionId === sectionId);
      for (const q of sectionQuestions) {
        await deleteDoc(doc(db, `papers/${activePaper.id}/questions`, q.id));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `papers/${activePaper.id}/sections/${sectionId}`);
    }
  };

  const saveSection = async () => {
    if (!activePaper || !editingSection || !editingSection.id || !isAuthReady) return;
    try {
      await updateDoc(doc(db, `papers/${activePaper.id}/sections`, editingSection.id), {
        title: editingSection.title,
        marks: editingSection.marks,
        questionCount: editingSection.questionCount
      });
      setEditingSection(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `papers/${activePaper.id}/sections/${editingSection.id}`);
    }
  };

  const saveQuestion = async () => {
    if (!activePaper || !editingQuestion || !editingQuestion.sectionId || !isAuthReady) return;
    
    const questionData = {
      text: editingQuestion.text || '',
      category: editingQuestion.category || 'General',
      marks: editingQuestion.marks || 1,
      imageUrl: editingQuestion.imageUrl || '',
      sectionId: editingQuestion.sectionId,
      order: editingQuestion.id ? editingQuestion.order : questions.filter(q => q.sectionId === editingQuestion.sectionId).length
    };

    try {
      if (editingQuestion.id) {
        await updateDoc(doc(db, `papers/${activePaper.id}/questions`, editingQuestion.id), questionData);
      } else {
        await addDoc(collection(db, `papers/${activePaper.id}/questions`), questionData);
      }
      setEditingQuestion(null);
    } catch (error) {
      handleFirestoreError(error, editingQuestion.id ? OperationType.UPDATE : OperationType.CREATE, `papers/${activePaper.id}/questions`);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!activePaper || !isAuthReady) return;
    try {
      await deleteDoc(doc(db, `papers/${activePaper.id}/questions`, questionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `papers/${activePaper.id}/questions/${questionId}`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `questions/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setEditingQuestion(prev => ({ ...prev, imageUrl: url }));
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !activePaper || !isAuthReady) return;

    const oldIndex = questions.findIndex(q => q.id === active.id);
    const newIndex = questions.findIndex(q => q.id === over.id);
    
    const newQuestions = arrayMove(questions, oldIndex, newIndex) as Question[];
    
    try {
      for (let i = 0; i < newQuestions.length; i++) {
        if (newQuestions[i].order !== i) {
          await updateDoc(doc(db, `papers/${activePaper.id}/questions`, newQuestions[i].id), {
            order: i
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `papers/${activePaper.id}/questions`);
    }
  };

  const exportToPDF = async () => {
    if (!paperRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(paperRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${activePaper?.title || 'Question_Paper'}.pdf`);
    } catch (error) {
      console.error("PDF Export failed", error);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center"
        >
          <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <FileText size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">QSetter</h1>
          <p className="text-slate-600 mb-8">The ultimate question paper builder for modern teachers.</p>
          
          {loginError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 text-left">
              <AlertTriangle className="text-red-500 shrink-0" size={18} />
              <p className="text-sm text-red-600">{loginError}</p>
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={loginLoading}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loginLoading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            )}
            {loginLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>
          
          <p className="mt-6 text-xs text-slate-400">
            Note: Ensure popups are allowed and the domain is authorized in your Firebase Console.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActivePaper(null)}>
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center">
              <FileText size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">QSetter</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{user.displayName}</span>
              <span className="text-xs text-slate-500">{user.email}</span>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!activePaper ? (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Your Question Papers</h2>
                <p className="text-slate-500">Manage and create your exam materials.</p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={loadSampleData}
                  className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-200 transition-colors flex items-center gap-2"
                >
                  <Save size={18} />
                  Load Sample
                </button>
                <button 
                  onClick={() => setIsCreatingPaper(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Plus size={20} />
                  New Paper
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {papers.map(paper => (
                <motion.div 
                  key={paper.id}
                  whileHover={{ y: -4 }}
                  className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                  onClick={() => setActivePaper(paper)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <FileText size={24} />
                    </div>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!isAuthReady) return;
                        try {
                          await deleteDoc(doc(db, 'papers', paper.id));
                        } catch (error) {
                          handleFirestoreError(error, OperationType.DELETE, `papers/${paper.id}`);
                        }
                      }}
                      className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <h3 className="text-lg font-bold mb-1">{paper.title}</h3>
                  <p className="text-slate-500 text-sm mb-4">{paper.subject || 'No Subject'}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{paper.createdAt?.toDate().toLocaleDateString()}</span>
                    <span className="flex items-center gap-1 text-indigo-600 font-medium">
                      Edit <ChevronRight size={14} />
                    </span>
                  </div>
                </motion.div>
              ))}
              
              {papers.length === 0 && !isCreatingPaper && (
                <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
                  <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">No question papers yet. Create your first one!</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-4 space-y-6">
              <button 
                onClick={() => setActivePaper(null)}
                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors mb-4"
              >
                <ChevronLeft size={20} />
                Back to Dashboard
              </button>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <PlusCircle size={20} className="text-indigo-600" />
                  Add Content
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={addSection}
                    className="flex flex-col items-center justify-center p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors gap-2"
                  >
                    <Plus size={20} className="text-slate-400" />
                    <span className="text-sm font-medium">New Section</span>
                  </button>
                  <button 
                    onClick={() => setEditingQuestion({ sectionId: sections[0]?.id })}
                    className="flex flex-col items-center justify-center p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors gap-2"
                  >
                    <PlusCircle size={20} className="text-slate-400" />
                    <span className="text-sm font-medium">New Question</span>
                  </button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <Download size={20} className="text-indigo-600" />
                  Export Options
                </h3>
                <button 
                  onClick={exportToPDF}
                  disabled={exporting}
                  className="w-full bg-slate-900 text-white py-3 rounded-lg font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {exporting ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                  Export as PDF
                </button>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div 
                ref={paperRef}
                className="bg-white shadow-2xl rounded-sm min-h-[1122px] w-full p-12 mx-auto border border-slate-200"
                style={{ maxWidth: '800px' }}
              >
                <div className="text-center border-b-2 border-slate-900 pb-6 mb-8">
                  <h1 className="text-3xl font-serif font-bold uppercase tracking-widest mb-2">{activePaper.title}</h1>
                  <div className="flex justify-between text-sm font-medium uppercase tracking-wider">
                    <span>Subject: {activePaper.subject}</span>
                    <span>Time: 3 Hours</span>
                    <span>Max Marks: {sections.reduce((acc, s) => acc + s.marks, 0)}</span>
                  </div>
                </div>

                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <div className="space-y-8">
                    {sections.map(section => (
                      <div key={section.id} className="relative group/section">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-2">
                          <div className="flex flex-col">
                            <h2 className="text-xl font-bold uppercase">{section.title} ({section.marks} Marks)</h2>
                            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                              Answer any {section.questionCount} questions
                            </span>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover/section:opacity-100 transition-opacity print:hidden">
                            <button 
                              onClick={() => setEditingSection(section)}
                              className="p-1 text-slate-600 hover:bg-slate-50 rounded"
                              title="Section Settings"
                            >
                              <Save size={18} />
                            </button>
                            <button 
                              onClick={() => setEditingQuestion({ sectionId: section.id })}
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                              title="Add Question"
                            >
                              <Plus size={18} />
                            </button>
                            <button 
                              onClick={() => deleteSection(section.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Delete Section"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        <SortableContext 
                          items={questions.filter(q => q.sectionId === section.id).map(q => q.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          <div className="space-y-4">
                            {questions
                              .filter(q => q.sectionId === section.id)
                              .map((q) => (
                                <SortableQuestion 
                                  key={q.id} 
                                  question={q} 
                                  onEdit={(q) => setEditingQuestion(q)}
                                  onDelete={(id) => deleteQuestion(id)}
                                />
                              ))}
                            {questions.filter(q => q.sectionId === section.id).length === 0 && (
                              <div className="py-8 text-center text-slate-400 italic border-2 border-dashed border-slate-100 rounded-lg">
                                No questions in this section.
                              </div>
                            )}
                          </div>
                        </SortableContext>
                      </div>
                    ))}
                  </div>
                </DndContext>
              </div>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {isCreatingPaper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6">Create New Paper</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Paper Title</label>
                  <input 
                    type="text" 
                    value={newPaperTitle}
                    onChange={(e) => setNewPaperTitle(e.target.value)}
                    placeholder="e.g. Final Examination 2024"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
                  <input 
                    type="text" 
                    value={newPaperSubject}
                    onChange={(e) => setNewPaperSubject(e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setIsCreatingPaper(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={createPaper}
                    disabled={!newPaperTitle}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Section Editor Modal */}
        {editingSection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-2xl font-bold mb-6">Section Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Section Title</label>
                  <input 
                    type="text" 
                    value={editingSection.title || ''}
                    onChange={(e) => setEditingSection(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Total Marks</label>
                    <input 
                      type="number" 
                      value={editingSection.marks || 0}
                      onChange={(e) => setEditingSection(prev => ({ ...prev, marks: parseInt(e.target.value) }))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">No. of Questions</label>
                    <input 
                      type="number" 
                      value={editingSection.questionCount || 0}
                      onChange={(e) => setEditingSection(prev => ({ ...prev, questionCount: parseInt(e.target.value) }))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setEditingSection(null)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveSection}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {editingQuestion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-bold mb-6">{editingQuestion.id ? 'Edit Question' : 'Add Question'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Section</label>
                  <select 
                    value={editingQuestion.sectionId}
                    onChange={(e) => setEditingQuestion(prev => ({ ...prev, sectionId: e.target.value }))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <input 
                      type="text" 
                      value={editingQuestion.category || ''}
                      onChange={(e) => setEditingQuestion(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="e.g. MCQ"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Marks</label>
                    <input 
                      type="number" 
                      value={editingQuestion.marks || 1}
                      onChange={(e) => setEditingQuestion(prev => ({ ...prev, marks: parseInt(e.target.value) }))}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Question Text</label>
                  <textarea 
                    rows={4}
                    value={editingQuestion.text || ''}
                    onChange={(e) => setEditingQuestion(prev => ({ ...prev, text: e.target.value }))}
                    placeholder="Enter the question text here..."
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Image (Optional)</label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                      <ImageIcon size={20} className="text-slate-400" />
                      <span className="text-sm text-slate-500">{uploadingImage ? 'Uploading...' : 'Upload Diagram/Equation'}</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </label>
                    {editingQuestion.imageUrl && (
                      <div className="relative w-20 h-20 border border-slate-200 rounded overflow-hidden">
                        <img src={editingQuestion.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                        <button 
                          onClick={() => setEditingQuestion(prev => ({ ...prev, imageUrl: '' }))}
                          className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setEditingQuestion(null)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveQuestion}
                    disabled={!editingQuestion.text || uploadingImage}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    Save Question
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
