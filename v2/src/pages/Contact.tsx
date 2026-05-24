import { useEffect, useState } from 'react';
import { Layout, Clock } from '../components/Layout';

const ENC = '7981269 2151 94+';

export function Contact() {
  const [phone, setPhone] = useState('');
  useEffect(() => { setPhone(ENC.split('').reverse().join('')); }, []);

  const meta = (
    <>
      <span className="dot" />
      <span>HAM · 53.55 N</span>
      <span>·</span>
      <Clock />
    </>
  );

  return (
    <Layout page="contact" meta={meta} contentClass="content--contact">
      <div className="col-label">
        <span className="label-kicker">Get in touch</span>
        <h1 className="label-heading">Let's<br />work<br />together.</h1>
        <p className="label-sub">
          Procedural Houdini / Technical 3D Artist.<br />
          Simulation, procedural animation,<br />
          product/industrial visuals and render-ready<br />
          3D systems for agencies and B2B clients.<br />
          <br />
          AI-assisted concepting and image workflows<br />
          used where they improve iteration,<br />
          variation or look development.
        </p>
      </div>

      <div className="col-fields">
        <div className="field">
          <span className="field-idx">001</span>
          <div>
            <div className="field-label">Email</div>
            <div className="field-value">
              <a href="mailto:connilefleur@protonmail.com">connilefleur@protonmail.com</a>
            </div>
          </div>
        </div>

        {phone && (
          <div className="field">
            <span className="field-idx">002</span>
            <div>
              <div className="field-label">Phone</div>
              <div className="field-value">
                <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>
              </div>
            </div>
          </div>
        )}

        <div className="field">
          <span className="field-idx">003</span>
          <div>
            <div className="field-label">Studio</div>
            <div className="field-value">Hamburg, DE · Remote</div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">004</span>
          <div>
            <div className="field-label">Availability</div>
            <div className="field-value">
              <span className="avail">
                <span className="avail-dot" aria-hidden="true" />
                Open to new projects
              </span>
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">005</span>
          <div>
            <div className="field-label">Focus</div>
            <div className="field-value is-mute">
              Procedural Houdini · Simulation · Lookdev/Rendering<br />
              Product &amp; Abstract 3D · Pipeline Support
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">006</span>
          <div>
            <div className="field-label">Services</div>
            <div className="field-value is-mute">
              Procedural Houdini setups<br />
              Simulation / Vellum / particles<br />
              Product and abstract 3D animation<br />
              Technical 3D / lookdev / rendering<br />
              AOV / ACES / render delivery<br />
              AI-assisted concepting (ComfyUI / OTOY Canvas)
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">007</span>
          <div>
            <div className="field-label">Tools</div>
            <div className="field-value is-mute">
              Houdini · Nuke · Blender · Octane<br />
              ComfyUI · OTOY Canvas<br />
              Resolve · Adobe Suite
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">008</span>
          <div>
            <div className="field-label">Environment</div>
            <div className="field-value is-mute">Linux Native</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
