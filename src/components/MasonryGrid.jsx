import { useWorks } from '../lib/edits'
import WorkCard from './WorkCard'

export default function MasonryGrid() {
  const works = useWorks()
  return (
    <div className="masonry">
      {works.map((work, i) => (
        <WorkCard key={work.id} work={work} index={i + 1} />
      ))}
    </div>
  )
}
