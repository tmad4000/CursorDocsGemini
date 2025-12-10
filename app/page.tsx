import MainLayout from "@/components/Layout/MainLayout";
import AISidebar from "@/components/Sidebar/AISidebar";
import RichTextEditor from "@/components/Editor/RichTextEditor";
import { EditorProvider } from "@/context/EditorContext";

export default function Home() {
  return (
    <EditorProvider>
      <MainLayout
        sidebar={<AISidebar />}
        editor={<RichTextEditor />}
      />
    </EditorProvider>
  );
}
