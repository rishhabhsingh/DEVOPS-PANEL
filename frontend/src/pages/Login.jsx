const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] px-4">
      <div className="w-full max-w-md space-y-8">

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="text-4xl">🚀</div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            DevOps Panel
          </h1>
          <p className="text-gray-400">
            Deploy your GitHub projects in seconds
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#161616] border border-gray-800 rounded-2xl p-8 space-y-6">

          {/* Features */}
          <div className="space-y-3">
            {[
              { icon: '⚡', text: 'Auto-containerize any project' },
              { icon: '📡', text: 'Real-time build log streaming' },
              { icon: '↩', text: 'One-click rollback to any version' },
              { icon: '🔐', text: 'Encrypted environment variables' },
              { icon: '🤖', text: 'AI-powered failure analysis' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-lg">{f.icon}</span>
                <span className="text-gray-300 text-sm">{f.text}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800"/>

          {/* GitHub login button */}
          <a
            href="https://drive-roster-fine-applications.trycloudflare.com/auth/github"
            className="flex items-center justify-center gap-3
                       bg-white hover:bg-gray-100 text-black
                       font-semibold py-3 px-6 rounded-xl
                       transition-all duration-200 w-full"
          >
            <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425
                   2.865 8.18 6.839 9.504.5.092.682-.217.682-.483
                   0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343
                   -3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908
                   -.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531
                   1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35
                   -1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951
                   0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272
                   .098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0
                   0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909
                   -1.296 2.747-1.027 2.747-1.027.546 1.379.202
                   2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0
                   3.848-2.339 4.695-4.566 4.943.359.309.678.92.678
                   1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58
                   .688.482A10.02 10.02 0 0 0 22 12.017C22 6.484
                   17.522 2 12 2z"/>
            </svg>
            Continue with GitHub
          </a>

          <p className="text-center text-gray-600 text-xs">
            Only repo access is requested. No write permissions.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;