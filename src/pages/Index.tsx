
import ChatInterface from "@/components/ChatInterface";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-whimsy-50 to-whimsy-100 dark:from-gray-900 dark:to-gray-800">
      <main className="flex-grow flex items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="w-full max-w-4xl h-[80vh] bg-background dark:bg-gray-800 rounded-xl overflow-hidden shadow-lg border">
          <ChatInterface />
        </div>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground">
        <p>Whimsy &copy; {new Date().getFullYear()} - Random Chat</p>
      </footer>
    </div>
  );
};

export default Index;
