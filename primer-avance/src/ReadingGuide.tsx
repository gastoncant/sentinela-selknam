export function ReadingGuide() {
  return <section className="reading-guide" aria-labelledby="reading-title">
    <div className="reading-title"><span aria-hidden="true">?</span><h3 id="reading-title">Qué estás viendo</h3></div>
    <p>El control muestra <strong>dos imágenes del mismo lugar</strong>. Los contornos señalan dónde cambió la señal entre las dos fechas y permanecen en el mismo sitio al deslizar. La trama oscura queda fuera de la imagen del recorte.</p>
    <div className="reading-keys">
      <div><i className="water-key" aria-hidden="true" /><span><strong>Celeste · más señal de agua</strong><span>Áreas donde aumentó el índice de agua, incluso si ya había agua antes.</span></span></div>
      <div><i className="vegetation-key" aria-hidden="true" /><span><strong>Naranja · menos señal de vegetación</strong><span>Áreas donde disminuyó el índice de vegetación.</span></span></div>
      <div><i className="infrared-key" aria-hidden="true" /><span><strong>Rojo de la imagen · vegetación</strong><span>Es una combinación infrarroja de bandas; el rojo no señala daño por sí solo.</span></span></div>
      <div><i className="missing-key" aria-hidden="true" /><span><strong>Gris · sin comparación válida</strong><span>Píxeles excluidos por nubes, sombras u otras condiciones.</span></span></div>
    </div>
    <p className="reading-next"><strong>Para interpretar un cambio:</strong> abrí una zona de la lista y compará sus dos ampliaciones. Un contorno agrupa píxeles vecinos con cambio de señal; no representa una cuenca ni identifica un dique confirmado.</p>
  </section>;
}
