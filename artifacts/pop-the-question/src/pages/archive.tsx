import { useState } from "react";
import { Link } from "wouter";
import { useGetThreeStrikesArchive, useGetCrosswordArchive } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { ArrowLeft, PlayCircle, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Archive() {
  const { data: tsArchive, isLoading: tsLoading } = useGetThreeStrikesArchive();
  const { data: cwArchive, isLoading: cwLoading } = useGetCrosswordArchive();

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-12">
      <Link href="/">
        <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-primary">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back Home
        </Button>
      </Link>

      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black font-display text-accent">Puzzle Archive</h1>
        <p className="text-xl text-muted-foreground mt-2">Missed a day? Catch up here.</p>
      </header>

      <Tabs defaultValue="three-strikes" className="w-full">
        <TabsList className="w-full justify-start border-b border-border/50 rounded-none bg-transparent h-auto p-0 mb-8 space-x-8">
          <TabsTrigger 
            value="three-strikes"
            className="text-lg pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold"
          >
            Three Strikes
          </TabsTrigger>
          <TabsTrigger 
            value="crossword"
            className="text-lg pb-4 rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold"
          >
            Mini Crossword
          </TabsTrigger>
        </TabsList>

        <TabsContent value="three-strikes">
          {tsLoading ? (
            <div>Loading...</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tsArchive?.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="p-6 bg-card/50 hover:bg-card border-border hover:border-primary/50 transition-colors flex flex-col h-full group">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono mb-4">
                      <Calendar className="w-4 h-4" /> {item.date}
                    </div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{item.title}</h3>
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-6 flex-1">{item.prompt}</p>
                    <Link href={`/daily/three-strikes`}>
                      <Button className="w-full bg-primary/10 text-primary hover:bg-primary hover:text-white group-hover:bg-primary group-hover:text-white transition-colors" data-testid={`btn-play-ts-${item.id}`}>
                        <PlayCircle className="w-4 h-4 mr-2" /> Play
                      </Button>
                    </Link>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="crossword">
          {cwLoading ? (
            <div>Loading...</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {cwArchive?.map((item, i) => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="p-6 bg-card/50 hover:bg-card border-border hover:border-cyan-400/50 transition-colors flex flex-col h-full group">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono mb-4">
                      <Calendar className="w-4 h-4" /> {item.date}
                    </div>
                    <h3 className="text-xl font-bold mb-6 group-hover:text-cyan-400 transition-colors">Daily Mini</h3>
                    <Link href={`/daily/crossword`}>
                      <Button className="w-full bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400 hover:text-background group-hover:bg-cyan-400 group-hover:text-background transition-colors" data-testid={`btn-play-cw-${item.id}`}>
                        <PlayCircle className="w-4 h-4 mr-2" /> Play
                      </Button>
                    </Link>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
