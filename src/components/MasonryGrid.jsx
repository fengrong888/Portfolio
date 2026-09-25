import { works } from '../data/works'
import WorkCard from './WorkCard'

export default function MasonryGrid() {
  return (
    <div className="masonry">
      {works.map((work, i) => (
        <WorkCard key={work.id} work={work} index={i + 1} />
      ))}
    </div>
  )
}
