import ProfileSettings from '@/components/profile-settings';

export default function DesignPreviewProfilePage() {
  const mockUser = {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'student@example.com',
  };

  const mockRole = 'student';

  return (
    <div className="min-h-svh w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-pink-400/20 to-orange-400/20 rounded-full blur-3xl float" style={{animationDelay: '3s'}}></div>
      </div>

      <div className="w-full max-w-lg animate-[slideInUp_600ms_ease] relative z-10">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8">
          <ProfileSettings user={mockUser} userRole={mockRole} />
        </div>
      </div>
    </div>
  );
}
