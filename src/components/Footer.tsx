const Footer = () => {
  return (
    <footer className="border-t border-border mt-auto py-8">
      <div className="container mx-auto px-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          </div>
          <span className="font-mono text-sm text-muted-foreground">CyberWiki</span>
        </div>
        <p className="text-xs text-muted-foreground max-w-md mx-auto mb-2">
          Student-generated content — not officially affiliated with the University of Port Harcourt. All contributions are peer-reviewed for accuracy.
        </p>
        <p className="text-xs text-muted-foreground">
          © 2026 CyberWiki • Department of Cybersecurity, Uniport
        </p>
      </div>
    </footer>
  );
};

export default Footer;
