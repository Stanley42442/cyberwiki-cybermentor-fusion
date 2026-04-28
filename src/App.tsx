// src/App.tsx — full updated version with all new routes
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme-context";
import { AuthProvider } from "@/lib/auth-context";
import { CoursesProvider } from "@/lib/courses-context";
import { ContributionsProvider } from "@/lib/contributions-context";
import Index from "./pages/Index";
import Browse from "./pages/Browse";
import YearLevel from "./pages/YearLevel";
import CoursePage from "./pages/CoursePage";
import StudyNotePage from "./pages/StudyNotePage";
import Search from "./pages/Search";
import Contribute from "./pages/Contribute";
import Leaderboard from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminDashboard from "./pages/AdminDashboard";
import TutorPage from "./pages/TutorPage";
import CourseTutorPage from "./pages/CourseTutorPage";
import PastQuestionsPage from "./pages/PastQuestionsPage";
import DeptLandingPage from "./pages/DeptLandingPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CoursesProvider>
              <ContributionsProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/browse" element={<Browse />} />
                  <Route path="/year/:level" element={<YearLevel />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/course/:id" element={<CoursePage />} />
                  <Route path="/course/:id/study-note" element={<StudyNotePage />} />
                  <Route path="/course/:id/past-questions" element={<PastQuestionsPage />} />
                  <Route path="/course/:id/tutor" element={<CourseTutorPage />} />
                  <Route path="/contribute" element={<Contribute />} />
                  <Route path="/leaderboard" element={<Leaderboard />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/tutor" element={<TutorPage />} />
                  <Route path="/tutor/:courseId" element={<TutorPage />} />
                  <Route path="/dept/:deptId" element={<DeptLandingPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ContributionsProvider>
            </CoursesProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
